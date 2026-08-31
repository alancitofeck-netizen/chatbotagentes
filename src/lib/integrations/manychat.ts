import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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
    .select("webhook_secret, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  return {
    connected: data?.status === "active" && Boolean(data?.webhook_secret),
    webhookPath: MANYCHAT_WEBHOOK_PATH,
    webhookSecret: (data?.webhook_secret as string | null) ?? null,
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
  lastInteractionAt: string;
  createdAt: string;
  totalMessageCount: number;
  interactionLevel: "none" | "low" | "medium" | "high";
  interactionScore: number;
  leadStatus: string;
}

type ContactRow = { id: string; name: string | null; instagram_username: string | null; phone: string | null; email: string | null; created_at: string };

/** Para la pestaña CRM → Leads — un lead por contacto (`manychat_conversations`
 * ya es 1 fila por (workspace, contact)), ordenados por score real. */
export async function getManychatLeads(workspaceId: string): Promise<ManychatLeadListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manychat_conversations")
    .select("contact_id, last_interaction_at, lead_message_count, manychat_message_count, interaction_level, interaction_score, lead_status, contacts(id, name, instagram_username, phone, email, created_at)")
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
      lastInteractionAt: r.last_interaction_at as string,
      createdAt: contact?.created_at ?? (r.last_interaction_at as string),
      totalMessageCount: (r.lead_message_count as number) + (r.manychat_message_count as number),
      interactionLevel: r.interaction_level as ManychatLeadListItem["interactionLevel"],
      interactionScore: r.interaction_score as number,
      leadStatus: r.lead_status as string,
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
    .select("first_interaction_at, lead_message_count, manychat_message_count, captured_data")
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
      updated_at: nowIso,
    },
    { onConflict: "workspace_id,contact_id" },
  );

  return { contactId };
}
