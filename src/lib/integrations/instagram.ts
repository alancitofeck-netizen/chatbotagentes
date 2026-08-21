import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentMemberId } from "@/lib/auth/session";
import { notifyManagers } from "@/lib/notifications/service";

/**
 * Instagram OAuth ("Instagram API with Instagram Login") — mismo patrón
 * exacto que Google Calendar/Sheets/Drive (src/lib/integrations/googleCalendar.ts):
 * connect route arma la URL y redirige, callback intercambia el código,
 * getValidAccessToken refresca perezosamente y marca status='inactive' si
 * el token muere. Reusa las mismas funciones SQL genéricas de OAuth
 * (upsert_oauth_credentials/get_oauth_credentials/disconnect_oauth_integration,
 * 0018_calendar_oauth_credentials.sql) — cero funciones SQL nuevas.
 *
 * Shapes verificados contra la documentación pública de Meta
 * (developers.facebook.com/docs/instagram-platform), NO contra una cuenta
 * real conectada (no hay ninguna en este ambiente todavía) — ver el plan
 * "Integración nativa de Instagram" para las fuentes exactas.
 *
 * A diferencia de Google, el token de Instagram no tiene un refresh_token
 * separado — el "long-lived token" (60 días) ES la credencial completa, y
 * se refresca llamando a un endpoint con el propio token vigente (nunca
 * puede refrescarse si ya expiró — por eso se refresca con margen de días,
 * no de minutos como Google).
 */

const PROVIDER = "instagram";
const IG_OAUTH_URL = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH_URL = "https://graph.instagram.com";
const IG_API_VERSION = "v25.0";
const SCOPE = "instagram_business_basic,instagram_business_manage_messages";

interface InstagramTokenBundle {
  accessToken: string;
  expiresAt: string; // ISO — vencimiento del long-lived token (60 días)
  lastRefreshedAt: string; // ISO — Meta exige >24h entre refreshes
}

export function getInstagramAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.INSTAGRAM_APP_ID;
  if (!clientId) throw new Error("INSTAGRAM_APP_ID no está configurado.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
  });
  return `${IG_OAUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForShortLivedToken(code: string, redirectUri: string): Promise<{ accessToken: string; userId: string }> {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!clientId || !clientSecret) throw new Error("Instagram OAuth no está configurado (faltan INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET).");

  const res = await fetch(IG_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Instagram rechazó el intercambio de código: ${JSON.stringify(data)}`);

  // La respuesta puede venir como {data:[{access_token,user_id}]} o plana
  // {access_token,user_id} según el flujo — se leen ambas formas
  // defensivamente (no confirmado contra una respuesta real todavía).
  const row = Array.isArray(data?.data) ? data.data[0] : data;
  if (!row?.access_token) throw new Error("Instagram no devolvió un token de acceso.");
  return { accessToken: row.access_token as string, userId: String(row.user_id) };
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!clientSecret) throw new Error("INSTAGRAM_APP_SECRET no está configurado.");

  const params = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: clientSecret, access_token: shortLivedToken });
  const res = await fetch(`${IG_GRAPH_URL}/access_token?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(`No se pudo obtener un token de larga duración: ${JSON.stringify(data)}`);
  return { accessToken: data.access_token as string, expiresInSeconds: (data.expires_in as number) ?? 60 * 24 * 60 * 60 };
}

interface InstagramAccountInfo {
  userId: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
}

async function getInstagramAccountInfo(accessToken: string): Promise<InstagramAccountInfo> {
  const params = new URLSearchParams({ fields: "user_id,username,name,profile_picture_url", access_token: accessToken });
  const res = await fetch(`${IG_GRAPH_URL}/me?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error("No se pudo resolver la cuenta de Instagram conectada.");
  return {
    userId: String(data.user_id ?? data.id),
    username: data.username as string,
    name: (data.name as string | undefined) ?? null,
    profilePictureUrl: (data.profile_picture_url as string | undefined) ?? null,
  };
}

/** Llamado desde la ruta de callback — mismo patrón que connectGoogleCalendar:
 * cliente de sesión (el usuario ya autenticado), RPC genérica de Vault. */
export async function connectInstagram(workspaceId: string, code: string, redirectUri: string): Promise<void> {
  const shortLived = await exchangeCodeForShortLivedToken(code, redirectUri);
  const longLived = await exchangeForLongLivedToken(shortLived.accessToken);
  const account = await getInstagramAccountInfo(longLived.accessToken);

  const nowIso = new Date().toISOString();
  const tokens: InstagramTokenBundle = {
    accessToken: longLived.accessToken,
    expiresAt: new Date(Date.now() + longLived.expiresInSeconds * 1000).toISOString(),
    lastRefreshedAt: nowIso,
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    p_external_account_id: account.userId,
    p_secret_json: JSON.stringify(tokens),
  });
  if (error) throw new Error("No se pudo guardar la conexión con Instagram.");

  await supabase
    .from("integration_connections")
    .update({ metadata: { username: account.username, name: account.name, profilePictureUrl: account.profilePictureUrl } })
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER);
}

export async function disconnectInstagram(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("disconnect_oauth_integration", { p_workspace_id: workspaceId, p_provider: PROVIDER });

  const ownMemberId = await getCurrentMemberId(workspaceId);
  await notifyManagers(
    workspaceId,
    { eventType: "integration_disconnected", title: "Integración desconectada", message: "Instagram se desconectó.", actionUrl: "/profile" },
    ownMemberId,
  );
}

export interface InstagramStatus {
  connected: boolean;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  /** true = el token murió (falló el refresh) — mismo criterio "needs
   * reauth" que Google Calendar, pero acá SÍ se distingue visualmente
   * (ver InstagramConnectionCard.tsx) de un desconectado normal, porque a
   * diferencia de Calendar el usuario pidió explícitamente un estado
   * "🟡 Reautorización requerida". */
  needsReauth: boolean;
}

export async function getInstagramStatus(workspaceId: string): Promise<InstagramStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("status, metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (!data) return { connected: false, username: null, name: null, profilePictureUrl: null, needsReauth: false };
  const metadata = (data.metadata as { username?: string; name?: string; profilePictureUrl?: string } | null) ?? {};
  return {
    connected: data.status === "active",
    username: metadata.username ?? null,
    name: metadata.name ?? null,
    profilePictureUrl: metadata.profilePictureUrl ?? null,
    needsReauth: data.status === "inactive",
  };
}

/** Refresca perezosamente el long-lived token (Meta exige que hayan pasado
 * >24h desde el último refresh, y solo hace falta antes de que venza —
 * acá con margen de 7 días, no de minutos como Google, porque el ciclo de
 * vida es de 60 días, no de 1 hora). Marca status='inactive' ("needs
 * reauth") si el refresh falla — mismo criterio que Google Calendar. */
export async function getValidInstagramAccessToken(workspaceId: string): Promise<string | null> {
  const serviceClient = createServiceRoleClient();
  const { data: rpcData, error } = await serviceClient
    .rpc("get_oauth_credentials", { p_workspace_id: workspaceId, p_provider: PROVIDER })
    .maybeSingle();
  const data = rpcData as { external_account_id: string; secret_json: string } | null;
  if (error || !data?.secret_json) return null;

  const tokens = JSON.parse(data.secret_json) as InstagramTokenBundle;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const canRefresh = Date.now() - new Date(tokens.lastRefreshedAt).getTime() > oneDayMs;
  const needsRefresh = new Date(tokens.expiresAt).getTime() - Date.now() < sevenDaysMs;

  if (!needsRefresh || !canRefresh) return tokens.accessToken;

  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: tokens.accessToken });
  const res = await fetch(`${IG_GRAPH_URL}/refresh_access_token?${params.toString()}`);
  const refreshed = await res.json();
  if (!res.ok) {
    console.error(`[instagram] token refresh failed for workspace ${workspaceId}:`, refreshed);
    // Si el token ya venció del todo, Meta lo rechaza y no hay forma de
    // recuperarlo sin un nuevo login — mismo tratamiento que invalid_grant
    // de Google: marcar inactive para que la UI pida reconectar.
    if (new Date(tokens.expiresAt).getTime() < Date.now()) {
      await serviceClient.from("integration_connections").update({ status: "inactive" }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
    }
    return tokens.accessToken; // todavía no venció — se sigue usando hasta que sí
  }

  const refreshedTokens: InstagramTokenBundle = {
    accessToken: refreshed.access_token as string,
    expiresAt: new Date(Date.now() + ((refreshed.expires_in as number) ?? 60 * 24 * 60 * 60) * 1000).toISOString(),
    lastRefreshedAt: new Date().toISOString(),
  };
  await serviceClient.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    p_external_account_id: data.external_account_id,
    p_secret_json: JSON.stringify(refreshedTokens),
  });
  return refreshedTokens.accessToken;
}

/** Resuelve el workspace dueño de una conexión activa de Instagram a partir
 * del IG_ID que manda el webhook (`entry.id`) — mismo criterio que
 * resolveWorkspaceIdForYCloudAccount (src/lib/integrations/ycloud.ts), acá
 * más simple porque external_account_id ya es exactamente ese id (sin
 * normalización de formato de teléfono de por medio). */
export async function resolveWorkspaceIdForInstagramAccount(igAccountId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("workspace_id")
    .eq("provider", PROVIDER)
    .eq("external_account_id", igAccountId)
    .eq("status", "active")
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

/** Envía un mensaje de texto vía la Instagram Messaging API —
 * POST /{IG_ID}/messages. Usado por sendInstagram.ts. */
export async function sendInstagramMessage(accessToken: string, igAccountId: string, recipientId: string, text: string): Promise<{ recipientId: string; messageId: string }> {
  const res = await fetch(`${IG_GRAPH_URL}/${IG_API_VERSION}/${igAccountId}/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Instagram rechazó el envío: ${JSON.stringify(data)}`);
  return { recipientId: data.recipient_id as string, messageId: data.message_id as string };
}
