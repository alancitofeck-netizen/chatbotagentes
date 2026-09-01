import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calculateInteractionScore, deriveInteractionLevel } from "@/lib/integrations/manychatScoring";

const PROVIDER = "manychat";
/** Ruta del webhook, sin origin — la UI (ManyChatConnectionCard.tsx) le
 * antepone `window.location.origin`, así no hace falta un env var nuevo
 * solo para reconstruir la URL absoluta del propio sitio. */
export const MANYCHAT_WEBHOOK_PATH = "/api/integrations/manychat/webhook";

export interface ManychatConnectionStatus {
  connected: boolean;
  webhookPath: string;
  webhookSecret: string | null;
  /** Independiente del webhook — habilita "Sincronizar ahora" (API REST,
   * ver syncManychatContacts más abajo). Puede estar conectado por webhook
   * sin tener token (y viceversa), son dos direcciones distintas. */
  hasApiToken: boolean;
  lastSyncedAt: string | null;
}

/** El secreto es de menor sensibilidad que una credencial de un proveedor
 * externo (Vault) — es algo que GrowthLink emite para que el propio
 * usuario lo pegue en un paso de flujo de ManyChat, no algo que GrowthLink
 * use para autenticarse contra un tercero. Se muestra siempre que exista,
 * para poder volver a copiarlo sin tener que regenerarlo. */
export async function getManychatStatus(workspaceId: string): Promise<ManychatConnectionStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("webhook_secret, status, credentials_vault_ref, last_synced_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  return {
    connected: data?.status === "active" && Boolean(data?.webhook_secret),
    webhookPath: MANYCHAT_WEBHOOK_PATH,
    webhookSecret: (data?.webhook_secret as string | null) ?? null,
    hasApiToken: Boolean(data?.credentials_vault_ref),
    lastSyncedAt: (data?.last_synced_at as string | null) ?? null,
  };
}

/** Genera (o regenera) el secreto — regenerar invalida el anterior de
 * inmediato, el usuario tiene que actualizar el header en su flujo de
 * ManyChat o los próximos eventos se van a rechazar con 401. */
export async function generateManychatWebhookSecret(workspaceId: string): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("integration_connections").select("id").eq("workspace_id", workspaceId).eq("provider", PROVIDER).maybeSingle();

  if (existing) {
    await supabase.from("integration_connections").update({ webhook_secret: secret, status: "active" }).eq("id", existing.id);
  } else {
    // external_account_id es NOT NULL en integration_connections (pensado
    // para el id de la cuenta OAuth de un proveedor) — acá no hay cuenta
    // externa real, se usa el propio workspaceId como valor estable.
    const { error } = await supabase
      .from("integration_connections")
      .insert({ workspace_id: workspaceId, provider: PROVIDER, external_account_id: workspaceId, status: "active", webhook_secret: secret });
    if (error) throw new Error("No se pudo generar el secreto de ManyChat.");
  }
  return secret;
}

export async function disconnectManychat(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("integration_connections").update({ webhook_secret: null, status: "inactive" }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
}

export interface ManychatLeadListItem {
  contactId: string;
  name: string;
  instagramUsername: string | null;
  phone: string | null;
  email: string | null;
  firstInteractionAt: string;
  lastInteractionAt: string;
  createdAt: string;
  leadMessageCount: number;
  manychatMessageCount: number;
  totalMessageCount: number;
  interactionLevel: "none" | "low" | "medium" | "high";
  interactionScore: number;
  leadStatus: string;
  /** null cuando ManyChat nunca lo mandó (la inmensa mayoría) — ver nota en
   * ManychatWebhookPayload, nunca se completa solo. */
  source: string | null;
  contentName: string | null;
  entryPoint: string | null;
}

type ContactRow = { id: string; name: string | null; instagram_username: string | null; phone: string | null; email: string | null; created_at: string };

/** Para ManyChat → Leads — un lead por contacto (`manychat_conversations`
 * ya es 1 fila por (workspace, contact)), ordenados por score real. */
export async function getManychatLeads(workspaceId: string): Promise<ManychatLeadListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manychat_conversations")
    .select(
      "contact_id, first_interaction_at, last_interaction_at, lead_message_count, manychat_message_count, interaction_level, interaction_score, lead_status, source, content_name, entry_point, contacts(id, name, instagram_username, phone, email, created_at)",
    )
    .eq("workspace_id", workspaceId)
    .order("interaction_score", { ascending: false });

  return (data ?? []).map((r) => {
    const contact = (Array.isArray(r.contacts) ? r.contacts[0] : r.contacts) as ContactRow | null;
    return {
      contactId: r.contact_id as string,
      name: contact?.name ?? "Lead de Instagram",
      instagramUsername: contact?.instagram_username ?? null,
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
      firstInteractionAt: r.first_interaction_at as string,
      lastInteractionAt: r.last_interaction_at as string,
      createdAt: contact?.created_at ?? (r.last_interaction_at as string),
      leadMessageCount: r.lead_message_count as number,
      manychatMessageCount: r.manychat_message_count as number,
      totalMessageCount: (r.lead_message_count as number) + (r.manychat_message_count as number),
      interactionLevel: r.interaction_level as ManychatLeadListItem["interactionLevel"],
      interactionScore: r.interaction_score as number,
      leadStatus: r.lead_status as string,
      source: (r.source as string | null) ?? null,
      contentName: (r.content_name as string | null) ?? null,
      entryPoint: (r.entry_point as string | null) ?? null,
    };
  });
}

export interface ManychatLeadDetail {
  instagramUsername: string | null;
  firstInteractionAt: string;
  lastInteractionAt: string;
  leadMessageCount: number;
  manychatMessageCount: number;
  interactionLevel: "none" | "low" | "medium" | "high";
  interactionScore: number;
  capturedData: Record<string, unknown>;
  source: string | null;
  contentName: string | null;
  entryPoint: string | null;
  campaign: string | null;
  messages: { id: string; direction: "inbound" | "outbound"; body: string | null; createdAt: string }[];
}

/** Para la ficha del contacto — null si este contacto nunca tuvo actividad
 * de ManyChat (la sección entera se oculta en ese caso). */
export async function getManychatLeadDetail(workspaceId: string, contactId: string): Promise<ManychatLeadDetail | null> {
  const supabase = await createClient();
  const [{ data: rollup }, { data: contact }, { data: messages }] = await Promise.all([
    supabase.from("manychat_conversations").select("*").eq("workspace_id", workspaceId).eq("contact_id", contactId).maybeSingle(),
    supabase.from("contacts").select("instagram_username").eq("id", contactId).maybeSingle(),
    supabase.from("manychat_messages").select("id, direction, body, created_at").eq("workspace_id", workspaceId).eq("contact_id", contactId).order("created_at", { ascending: true }),
  ]);
  if (!rollup) return null;

  return {
    instagramUsername: (contact?.instagram_username as string | null) ?? null,
    firstInteractionAt: rollup.first_interaction_at as string,
    lastInteractionAt: rollup.last_interaction_at as string,
    leadMessageCount: rollup.lead_message_count as number,
    manychatMessageCount: rollup.manychat_message_count as number,
    interactionLevel: rollup.interaction_level as ManychatLeadDetail["interactionLevel"],
    interactionScore: rollup.interaction_score as number,
    capturedData: (rollup.captured_data as Record<string, unknown>) ?? {},
    source: (rollup.source as string | null) ?? null,
    contentName: (rollup.content_name as string | null) ?? null,
    entryPoint: (rollup.entry_point as string | null) ?? null,
    campaign: (rollup.campaign as string | null) ?? null,
    messages: (messages ?? []).map((m) => ({
      id: m.id as string,
      direction: m.direction as "inbound" | "outbound",
      body: (m.body as string | null) ?? null,
      createdAt: m.created_at as string,
    })),
  };
}

export async function updateManychatLeadStatus(workspaceId: string, contactId: string, status: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("manychat_conversations").update({ lead_status: status, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("contact_id", contactId);
}

/**
 * Ingesta de eventos de ManyChat — GrowthLink es un receptor pasivo: nunca
 * envía nada de vuelta a ManyChat, solo identifica al contacto, guarda el
 * evento (si trae un mensaje) y recalcula el rollup de actividad/score.
 * El shape del payload es deliberadamente flexible — ManyChat "External
 * Request" es un paso de flujo que el propio usuario arma a mano, así que
 * ningún campo salvo `manychat_contact_id` está garantizado.
 */
export interface ManychatMessagePayload {
  direction?: "inbound" | "outbound";
  body?: string;
}

export interface ManychatWebhookPayload {
  manychat_contact_id: string;
  instagram_username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: ManychatMessagePayload | null;
  custom_fields?: Record<string, unknown> | null;
  /** Ninguno de estos 4 es un system field real de ManyChat (confirmado
   * contra la documentación oficial) — solo llegan si el propio usuario los
   * escribe a mano como texto fijo en el paso "External Request" de cada
   * automatización puntual (una automatización por Reel/Story, por
   * ejemplo). Quedan null si no vienen, nunca se completan solos. */
  source?: string | null;
  content_name?: string | null;
  entry_point?: string | null;
  campaign?: string | null;
}

/** Dedup en 2 pasos: por manychat_contact_id primero (ya vinculado), si no
 * por instagram_username (puede ser el mismo contacto que ya existía por la
 * integración nativa de Instagram u otra vía) — nunca crea una persona
 * nueva para alguien que ya está en el CRM. Solo completa campos VACÍOS,
 * nunca pisa un dato real ya cargado a mano con algo que venga de ManyChat. */
async function findOrCreateManychatContact(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: ManychatWebhookPayload,
): Promise<string> {
  const { data: byManychatId } = await supabase
    .from("contacts")
    .select("id, phone, email, instagram_username")
    .eq("workspace_id", workspaceId)
    .eq("manychat_contact_id", payload.manychat_contact_id)
    .maybeSingle();

  if (byManychatId) {
    const update: Record<string, unknown> = {};
    if (!byManychatId.phone && payload.phone) update.phone = payload.phone;
    if (!byManychatId.email && payload.email) update.email = payload.email;
    if (!byManychatId.instagram_username && payload.instagram_username) update.instagram_username = payload.instagram_username;
    if (Object.keys(update).length) await supabase.from("contacts").update(update).eq("id", byManychatId.id);
    return byManychatId.id as string;
  }

  if (payload.instagram_username) {
    const { data: byUsername } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("instagram_username", payload.instagram_username)
      .maybeSingle();
    if (byUsername) {
      await supabase.from("contacts").update({ manychat_contact_id: payload.manychat_contact_id }).eq("id", byUsername.id);
      return byUsername.id as string;
    }
  }

  const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim() || payload.instagram_username?.trim() || "Lead de Instagram";
  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      name,
      phone: payload.phone?.trim() || null,
      email: payload.email?.trim() || null,
      source: "manychat",
      instagram_username: payload.instagram_username ?? null,
      manychat_contact_id: payload.manychat_contact_id,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("failed_to_create_contact");
  return created.id as string;
}

/** Único punto de entrada — llamado por el webhook route una vez que
 * verificó el secreto y resolvió el workspace. */
export async function processManychatEvent(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: ManychatWebhookPayload,
): Promise<{ contactId: string }> {
  const contactId = await findOrCreateManychatContact(supabase, workspaceId, payload);
  const nowIso = new Date().toISOString();

  if (payload.message?.body) {
    await supabase.from("manychat_messages").insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      direction: payload.message.direction === "outbound" ? "outbound" : "inbound",
      body: payload.message.body,
      event_type: "message",
      raw_payload: payload as unknown as Record<string, unknown>,
    });
  }

  const { data: existing } = await supabase
    .from("manychat_conversations")
    .select("first_interaction_at, lead_message_count, manychat_message_count, captured_data, source, content_name, entry_point, campaign")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .maybeSingle();

  const isInbound = payload.message?.body && payload.message.direction !== "outbound";
  const isOutbound = payload.message?.body && payload.message.direction === "outbound";

  const capturedData = { ...(existing?.captured_data as Record<string, unknown> | undefined), ...(payload.custom_fields ?? {}) };
  const leadMessageCount = (existing?.lead_message_count ?? 0) + (isInbound ? 1 : 0);
  const manychatMessageCount = (existing?.manychat_message_count ?? 0) + (isOutbound ? 1 : 0);
  const firstInteractionAt = existing?.first_interaction_at ?? nowIso;

  const { data: contact } = await supabase.from("contacts").select("phone, email").eq("id", contactId).maybeSingle();
  const durationMinutes = Math.max(0, (new Date(nowIso).getTime() - new Date(firstInteractionAt).getTime()) / 60_000);
  const score = calculateInteractionScore({
    leadMessageCount,
    manychatMessageCount,
    durationMinutes,
    capturedFieldsCount: Object.keys(capturedData).length,
    hasPhone: Boolean(contact?.phone),
    hasEmail: Boolean(contact?.email),
  });

  await supabase.from("manychat_conversations").upsert(
    {
      workspace_id: workspaceId,
      contact_id: contactId,
      manychat_contact_id: payload.manychat_contact_id,
      first_interaction_at: firstInteractionAt,
      last_interaction_at: nowIso,
      lead_message_count: leadMessageCount,
      manychat_message_count: manychatMessageCount,
      last_message_preview: payload.message?.body?.slice(0, 280) ?? undefined,
      interaction_score: score,
      interaction_level: deriveInteractionLevel(score),
      captured_data: capturedData,
      // Solo pisa si el payload trae un valor real — un evento posterior sin
      // `source` (la inmensa mayoría, ManyChat no lo manda solo) nunca borra
      // el que ya se había guardado a mano en un evento anterior.
      source: payload.source ?? existing?.source ?? null,
      content_name: payload.content_name ?? existing?.content_name ?? null,
      entry_point: payload.entry_point ?? existing?.entry_point ?? null,
      campaign: payload.campaign ?? existing?.campaign ?? null,
      updated_at: nowIso,
    },
    { onConflict: "workspace_id,contact_id" },
  );

  return { contactId };
}

const DASHBOARD_EVOLUTION_DAYS = 30;
const NEW_LEADS_WINDOW_DAYS = 30;

export interface ManychatDashboardSummary {
  totalLeads: number;
  /** Leads con intercambio real en ambos sentidos (lead_message_count>0 Y
   * manychat_message_count>0) — distinto de "leads totales", que incluye
   * cualquier contacto con al menos un evento aunque nunca haya respondido. */
  totalConversations: number;
  highInteractionCount: number;
  newLeadsInWindow: number;
  /** Teléfono Y email reales — no hay un campo "datos completos" en
   * ManyChat, es una definición propia de GrowthLink, documentada acá. */
  withCompleteDataCount: number;
  leadsBySource: { source: string; count: number }[];
  leadsByLevel: Record<"none" | "low" | "medium" | "high", number>;
  evolution: { label: string; count: number }[];
  topContent: { contentName: string; leadCount: number; highInteractionCount: number }[];
}

/** ManyChat → Resumen. Todo lo que sigue sale de conteos reales sobre
 * manychat_conversations/contacts — cuando `source`/`content_name` nunca se
 * configuraron (caso más común, ver nota en ManychatWebhookPayload), esos
 * buckets/listas simplemente salen vacíos o agrupados bajo "Sin
 * especificar", nunca se inventa una distribución. */
export async function getManychatDashboardSummary(workspaceId: string): Promise<ManychatDashboardSummary> {
  const supabase = await createClient();
  const since = new Date(Date.now() - DASHBOARD_EVOLUTION_DAYS * 24 * 60 * 60 * 1000);

  const { data: rows } = await supabase
    .from("manychat_conversations")
    .select("lead_message_count, manychat_message_count, interaction_level, source, content_name, created_at, contacts(phone, email)")
    .eq("workspace_id", workspaceId);

  const list = rows ?? [];
  const newSince = new Date(Date.now() - NEW_LEADS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const leadsByLevel: ManychatDashboardSummary["leadsByLevel"] = { none: 0, low: 0, medium: 0, high: 0 };
  const bySource = new Map<string, number>();
  const byContent = new Map<string, { leadCount: number; highInteractionCount: number }>();
  let totalConversations = 0;
  let withCompleteDataCount = 0;
  let newLeadsInWindow = 0;

  for (const r of list) {
    const level = r.interaction_level as keyof typeof leadsByLevel;
    leadsByLevel[level] = (leadsByLevel[level] ?? 0) + 1;

    if ((r.lead_message_count as number) > 0 && (r.manychat_message_count as number) > 0) totalConversations += 1;

    const sourceKey = (r.source as string | null)?.trim() || "Sin especificar";
    bySource.set(sourceKey, (bySource.get(sourceKey) ?? 0) + 1);

    const contentKey = (r.content_name as string | null)?.trim() || null;
    if (contentKey) {
      const entry = byContent.get(contentKey) ?? { leadCount: 0, highInteractionCount: 0 };
      entry.leadCount += 1;
      if (level === "high") entry.highInteractionCount += 1;
      byContent.set(contentKey, entry);
    }

    const contact = (Array.isArray(r.contacts) ? r.contacts[0] : r.contacts) as { phone: string | null; email: string | null } | null;
    if (contact?.phone && contact?.email) withCompleteDataCount += 1;

    if (new Date(r.created_at as string) >= newSince) newLeadsInWindow += 1;
  }

  // Evolución — se ancla a contacts.created_at (fecha real de captación),
  // no a manychat_conversations.created_at (que es "cuándo se creó el
  // rollup", casi lo mismo pero conceptualmente distinto).
  const { data: contactDates } = await supabase
    .from("contacts")
    .select("created_at")
    .eq("workspace_id", workspaceId)
    .eq("source", "manychat")
    .gte("created_at", since.toISOString());

  const dayBuckets = new Map<string, { label: string; count: number }>();
  for (let i = DASHBOARD_EVOLUTION_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dayBuckets.set(d.toDateString(), { label: d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" }), count: 0 });
  }
  for (const c of contactDates ?? []) {
    const key = new Date(c.created_at as string).toDateString();
    const bucket = dayBuckets.get(key);
    if (bucket) bucket.count += 1;
  }

  return {
    totalLeads: list.length,
    totalConversations,
    highInteractionCount: leadsByLevel.high,
    newLeadsInWindow,
    withCompleteDataCount,
    leadsBySource: [...bySource.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    leadsByLevel,
    evolution: [...dayBuckets.values()],
    topContent: [...byContent.entries()]
      .map(([contentName, v]) => ({ contentName, ...v }))
      .sort((a, b) => b.leadCount - a.leadCount)
      .slice(0, 10),
  };
}

export interface ManychatContentStat {
  contentName: string;
  source: string | null;
  leadCount: number;
  conversationCount: number;
  highInteractionCount: number;
  avgScore: number;
}

/** ManyChat → Contenido. Solo incluye leads con `content_name` real
 * (poblado a mano por el usuario en su flujo) — el resto queda fuera de
 * esta vista en vez de agruparse bajo un "sin contenido" que no aportaría
 * nada analizable. */
export async function getManychatContentStats(workspaceId: string): Promise<ManychatContentStat[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manychat_conversations")
    .select("content_name, source, lead_message_count, manychat_message_count, interaction_level, interaction_score")
    .eq("workspace_id", workspaceId)
    .not("content_name", "is", null);

  const byContent = new Map<string, { source: string | null; leadCount: number; conversationCount: number; highInteractionCount: number; scoreSum: number }>();
  for (const r of data ?? []) {
    const key = (r.content_name as string).trim();
    if (!key) continue;
    const entry = byContent.get(key) ?? { source: (r.source as string | null) ?? null, leadCount: 0, conversationCount: 0, highInteractionCount: 0, scoreSum: 0 };
    entry.leadCount += 1;
    if ((r.lead_message_count as number) > 0 && (r.manychat_message_count as number) > 0) entry.conversationCount += 1;
    if (r.interaction_level === "high") entry.highInteractionCount += 1;
    entry.scoreSum += r.interaction_score as number;
    byContent.set(key, entry);
  }

  return [...byContent.entries()]
    .map(([contentName, v]) => ({
      contentName,
      source: v.source,
      leadCount: v.leadCount,
      conversationCount: v.conversationCount,
      highInteractionCount: v.highInteractionCount,
      avgScore: Math.round(v.scoreSum / v.leadCount),
    }))
    .sort((a, b) => b.leadCount - a.leadCount);
}

// ---------------------------------------------------------------------------
// "Sincronizar ahora" — API REST de ManyChat (token propio del usuario,
// guardado en Vault, mismo RPC genérico upsert_oauth_credentials/
// get_oauth_credentials que ya usan Google Calendar/Instagram). Confirmado
// contra la documentación oficial: NO existe un endpoint de listado/
// exportación masiva de subscriptores — esto NUNCA descubre leads nuevos,
// solo refresca (tags/custom_fields/last_interaction) los contactos que
// GrowthLink ya conoce por haber llegado antes vía webhook.
// ---------------------------------------------------------------------------

export async function saveManychatApiToken(workspaceId: string, token: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    // No hay un "external account id" real acá (no es OAuth) — mismo
    // criterio ya usado para webhook_secret: se usa el propio workspaceId
    // como valor estable, la columna es NOT NULL.
    p_external_account_id: workspaceId,
    p_secret_json: JSON.stringify({ api_token: token }),
  });
  if (error) throw new Error("No se pudo guardar el token de ManyChat.");
}

interface ManychatGetInfoResponse {
  data?: {
    id?: number | string;
    tags?: { name: string }[];
    custom_fields?: { name: string; value: unknown }[];
    last_interaction?: string | null;
  };
}

/** Un solo contacto — la API no da opción de hacerlo en lote. */
async function fetchManychatSubscriberInfo(apiToken: string, manychatContactId: string): Promise<ManychatGetInfoResponse["data"] | null> {
  const res = await fetch(`https://api.manychat.com/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(manychatContactId)}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as ManychatGetInfoResponse;
  return body.data ?? null;
}

export interface ManychatSyncResult {
  refreshed: number;
  failed: number;
}

/** Recorre los contactos que YA tienen manychat_contact_id en este
 * workspace y refresca sus custom_fields reales contra la API — nunca crea
 * un contacto nuevo (eso solo lo hace el webhook). */
export async function syncManychatContacts(workspaceId: string): Promise<ManychatSyncResult> {
  const supabase = await createClient();
  // get_oauth_credentials solo tiene EXECUTE otorgado a service_role (mismo
  // motivo que getValidAccessToken en googleCalendar.ts: protege el secreto
  // de ser leído por cualquier query RLS-scoped) — llamarlo con el cliente
  // normal tira "permission denied" (era el error real detrás del digest
  // genérico que veía el usuario). El resto de esta función sigue en
  // `supabase` (RLS normal), solo esta lectura puntual necesita service-role.
  const serviceClient = createServiceRoleClient();
  const { data: credentialsRow } = await serviceClient.rpc("get_oauth_credentials", { p_workspace_id: workspaceId, p_provider: PROVIDER }).maybeSingle();
  const secretJson = (credentialsRow as { secret_json?: string } | null)?.secret_json;
  const apiToken = secretJson ? (JSON.parse(secretJson) as { api_token?: string }).api_token : null;
  if (!apiToken) throw new Error("Este workspace todavía no tiene un API Token de ManyChat conectado.");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, manychat_contact_id, phone, email")
    .eq("workspace_id", workspaceId)
    .not("manychat_contact_id", "is", null);

  let refreshed = 0;
  let failed = 0;
  for (const contact of contacts ?? []) {
    const info = await fetchManychatSubscriberInfo(apiToken, contact.manychat_contact_id as string);
    if (!info) {
      failed += 1;
      continue;
    }
    const customFields = Object.fromEntries((info.custom_fields ?? []).map((f) => [f.name, f.value]));
    await supabase
      .from("manychat_conversations")
      .update({ captured_data: customFields, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contact.id);
    refreshed += 1;
  }

  await supabase.from("integration_connections").update({ last_synced_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);

  return { refreshed, failed };
}
