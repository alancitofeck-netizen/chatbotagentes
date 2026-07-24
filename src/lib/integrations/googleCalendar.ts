import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CalendarEvent } from "@/lib/calendar/queries";
import { recordGrantedScopes } from "@/lib/integrations/googleAccount";

const PROVIDER = "google_calendar";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
// userinfo.email is included alongside calendar — without it, getGoogleAccountEmail's
// call to GOOGLE_USERINFO_URL below fails ("No se pudo resolver la cuenta de Google
// conectada.") because a token scoped only to a resource API lacks the identity
// scope userinfo requires (same fix already applied in googleSheets.ts's SCOPE).
const SCOPE = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email";

interface GoogleTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
}

/**
 * Real, functional Google Calendar OAuth2 integration (per explicit user
 * confirmation — they have Client ID/Secret ready). Requires
 * GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in .env.local and the redirect URI
 * below registered in Google Cloud Console for that OAuth client.
 *
 * Scope of this pass, explicitly: no Google push-notification webhooks
 * (events.watch) — those need a public HTTPS channel URL + renewal every
 * ~7 days, well beyond this pass and unusable from localhost anyway.
 * Google→CRM sync happens via importGoogleEvents (manual "Sincronizar
 * ahora" button + on calendar-open), not real-time push. CRM→Google sync
 * IS immediate (fire-and-forget after every internal create/update/delete
 * in src/lib/calendar/actions.ts).
 */

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID no está configurado.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Forces Google to return a refresh_token even if this account already
    // granted access before (otherwise a second consent silently omits it).
    prompt: "consent",
    // Merges this request's scope with whatever the same Google account
    // already granted elsewhere (e.g. via "Continuar con Google" login,
    // src/lib/integrations/googleAccount.ts) instead of narrowing the
    // consent screen down to only this scope — real incremental
    // authorization, per Google's own guidance.
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenBundle & { scope: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth no está configurado (faltan GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google rechazó el intercambio de código: ${JSON.stringify(data)}`);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: (data.scope as string | undefined) ?? "",
  };
}

async function getGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error("No se pudo resolver la cuenta de Google conectada.");
  return data.email as string;
}

/** Called from the OAuth callback route — writes the token bundle via the
 * generic Vault-backed RPC (0018_calendar_oauth_credentials.sql), using the
 * request-scoped client (the signed-in user's own session/cookies), same as
 * src/lib/integrations/actions.ts's saveWhatsAppIntegration. */
export async function connectGoogleCalendar(workspaceId: string, code: string, redirectUri: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  const email = await getGoogleAccountEmail(tokens.accessToken);

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    p_external_account_id: email,
    p_secret_json: JSON.stringify(tokens),
  });
  if (error) throw new Error("No se pudo guardar la conexión con Google Calendar.");

  // Best-effort — keeps the shared "already granted" ledger
  // (src/lib/integrations/googleAccount.ts) accurate for future incremental
  // requests. Never blocks the Calendar connection itself on failure.
  await recordGrantedScopes(workspaceId, tokens.scope).catch(() => {});
}

export async function disconnectGoogleCalendar(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("disconnect_oauth_integration", { p_workspace_id: workspaceId, p_provider: PROVIDER });
}

export interface GoogleCalendarStatus {
  connected: boolean;
  email: string | null;
}

export async function getGoogleCalendarStatus(workspaceId: string): Promise<GoogleCalendarStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("external_account_id, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .eq("status", "active")
    .maybeSingle();

  return { connected: Boolean(data), email: (data?.external_account_id as string | undefined) ?? null };
}

/** Reads the stored token bundle (service-role only — get_oauth_credentials
 * is restricted the same way get_whatsapp_credentials is, see
 * src/lib/integrations/ycloud.ts) and refreshes it via Google's token
 * endpoint if it's expired, re-saving the refreshed bundle. Returns null if
 * this workspace never connected Google Calendar. */
async function getValidAccessToken(workspaceId: string): Promise<string | null> {
  const serviceClient = createServiceRoleClient();
  const { data: rpcData, error } = await serviceClient
    .rpc("get_oauth_credentials", { p_workspace_id: workspaceId, p_provider: PROVIDER })
    .maybeSingle();
  const data = rpcData as { external_account_id: string; secret_json: string } | null;
  if (error || !data?.secret_json) return null;

  let tokens = JSON.parse(data.secret_json) as GoogleTokenBundle;
  if (new Date(tokens.expiresAt) > new Date(Date.now() + 60_000)) return tokens.accessToken;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !tokens.refreshToken) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await res.json();
  if (!res.ok) {
    console.error(`[google-calendar] token refresh failed for workspace ${workspaceId}:`, refreshed);
    // invalid_grant means the refresh token itself is dead (revoked, or the
    // 7-day refresh-token expiry Google applies to OAuth clients still in
    // "Testing" publishing status) and will never succeed on retry — see
    // the identical fix/comment in googleSheets.ts's getValidGoogleSheetsAccessToken.
    if (refreshed?.error === "invalid_grant") {
      await serviceClient.from("integration_connections").update({ status: "inactive" }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
    }
    return null;
  }

  tokens = { ...tokens, accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() };
  await serviceClient.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    p_external_account_id: data.external_account_id,
    p_secret_json: JSON.stringify(tokens),
  });
  return tokens.accessToken;
}

interface GoogleEventPayload {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
}

function toGooglePayload(event: CalendarEvent): GoogleEventPayload {
  return {
    summary: event.title,
    description: event.description ?? undefined,
    start: { dateTime: event.startTime, timeZone: event.timezone ?? undefined },
    end: { dateTime: event.endTime, timeZone: event.timezone ?? undefined },
    location: event.location ?? undefined,
  };
}

/** CRM→Google push. Fire-and-forget from src/lib/calendar/actions.ts — never
 * throws into the caller, just logs, matching the resilience rule already
 * established for YCloud sends (a Google hiccup must never block saving the
 * event in the CRM itself). */
export async function pushEventToGoogle(workspaceId: string, event: CalendarEvent): Promise<void> {
  if (event.provider !== "internal") return;
  try {
    const accessToken = await getValidAccessToken(workspaceId);
    if (!accessToken) return;

    const isUpdate = Boolean(event.externalId);
    const url = isUpdate ? `${GOOGLE_CALENDAR_EVENTS_URL}/${event.externalId}` : GOOGLE_CALENDAR_EVENTS_URL;
    const res = await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(toGooglePayload(event)),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[google-calendar] push failed for event ${event.id}:`, data);
      return;
    }
    if (!isUpdate) {
      const supabase = createServiceRoleClient();
      await supabase.from("bookings").update({ external_id: data.id }).eq("id", event.id);
    }
  } catch (err) {
    console.error(`[google-calendar] push threw for event ${event.id}:`, err);
  }
}

export async function deleteEventFromGoogle(workspaceId: string, event: CalendarEvent): Promise<void> {
  if (!event.externalId) return;
  try {
    const accessToken = await getValidAccessToken(workspaceId);
    if (!accessToken) return;
    await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}/${event.externalId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error(`[google-calendar] delete failed for event ${event.id}:`, err);
  }
}

/** Google→CRM import — manual ("Sincronizar ahora") + triggered when the
 * Calendar page loads, not a real-time push subscription (see module doc
 * comment above). Matches by external_id to avoid duplicating events this
 * same workspace already pushed the other direction. */
export async function importGoogleEvents(workspaceId: string): Promise<{ imported: number }> {
  const accessToken = await getValidAccessToken(workspaceId);
  if (!accessToken) return { imported: 0 };

  const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });

  const res = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`[google-calendar] import failed for workspace ${workspaceId}:`, data);
    return { imported: 0 };
  }

  const supabase = createServiceRoleClient();
  let imported = 0;
  for (const item of data.items ?? []) {
    if (!item.start?.dateTime || !item.end?.dateTime) continue; // skip all-day events (date-only) for this pass
    const { data: existing } = await supabase.from("bookings").select("id").eq("workspace_id", workspaceId).eq("external_id", item.id).maybeSingle();

    const row = {
      workspace_id: workspaceId,
      provider: "google" as const,
      external_id: item.id,
      subject: item.summary ?? "Evento de Google Calendar",
      description: item.description ?? null,
      start_time: item.start.dateTime,
      end_time: item.end.dateTime,
      location: item.location ?? null,
      status: item.status === "cancelled" ? "cancelled" : "scheduled",
    };

    if (existing) {
      await supabase.from("bookings").update(row).eq("id", existing.id);
    } else {
      await supabase.from("bookings").insert(row);
    }
    imported += 1;
  }

  return { imported };
}
