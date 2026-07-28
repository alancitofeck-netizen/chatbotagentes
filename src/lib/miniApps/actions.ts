"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { generateApiKey, hashApiKey, lastFour, slugify } from "@/lib/miniApps/apiKey";
import { createOpportunity, bulkAssignOwner } from "@/lib/crm/actions";
import {
  getMiniAppLeadDetail,
  getMiniAppsList,
  getMiniAppDetail,
  getMiniAppLeads,
  getMiniAppLeadsByDay,
  type MiniAppLeadFilters,
} from "@/lib/miniApps/queries";
import { resolveDateRange, type DateRangePreset } from "@/lib/crm/analyticsRange";
import { getDefaultOutboundBusinessNumber, getOrCreateOpenConversationForContact } from "@/lib/messaging/conversations";
import type { MiniAppLeadStatus, MiniAppTemplateKey } from "@/lib/miniApps/queries";

export async function getMiniAppsListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getMiniAppsList(workspaceId);
}

export async function getMiniAppDetailAction(id: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getMiniAppDetail(workspaceId, id);
}

export async function getMiniAppLeadsAction(miniAppId: string, filters?: MiniAppLeadFilters) {
  const { workspaceId } = await requireActiveWorkspace();
  return getMiniAppLeads(workspaceId, miniAppId, filters);
}

export async function getMiniAppLeadDetailAction(leadId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getMiniAppLeadDetail(workspaceId, leadId);
}

/** Reuses CRM Analytics' exact date-range resolution (src/lib/crm/analyticsRange.ts)
 * so the Analíticas tab's pill picker behaves identically. */
export async function getMiniAppLeadsByDayAction(miniAppId: string, preset: DateRangePreset, customStart?: string, customEnd?: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const range = resolveDateRange(preset, customStart, customEnd);
  return getMiniAppLeadsByDay(workspaceId, miniAppId, range.start, range.end);
}

function revalidateMiniAppsPaths(miniAppId?: string) {
  revalidatePath("/mini-apps");
  if (miniAppId) revalidatePath(`/mini-apps/${miniAppId}`);
}

export interface CreateMiniAppInput {
  name: string;
  description: string;
  templateKey: MiniAppTemplateKey;
  assignedAgentId: string | null;
  allowedOrigins: string[];
  externalUrl: string;
}

/** Generates the slug + API key here (not in the DB) so the plaintext key
 * can be returned to the caller exactly once — only its hash is persisted. */
export async function createMiniApp(input: CreateMiniAppInput): Promise<{ id: string; slug: string; apiKey: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");

  const createdBy = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const slug = slugify(input.name);
  const apiKey = generateApiKey();

  const { data, error } = await supabase
    .from("mini_apps")
    .insert({
      workspace_id: workspaceId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      template_key: input.templateKey,
      slug,
      external_url: input.externalUrl.trim() || null,
      assigned_agent_id: input.assignedAgentId,
      allowed_origins: input.allowedOrigins,
      api_key_hash: hashApiKey(apiKey),
      api_key_last4: lastFour(apiKey),
      created_by: createdBy,
    })
    .select("id, slug")
    .single();
  if (error || !data) throw new Error("No se pudo crear la mini app.");

  revalidateMiniAppsPaths();
  return { id: data.id as string, slug: data.slug as string, apiKey };
}

export interface UpdateMiniAppInput {
  name: string;
  description: string;
  assignedAgentId: string | null;
  allowedOrigins: string[];
  externalUrl: string;
  status: "active" | "inactive";
}

export async function updateMiniApp(id: string, input: UpdateMiniAppInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  await supabase
    .from("mini_apps")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      assigned_agent_id: input.assignedAgentId,
      allowed_origins: input.allowedOrigins,
      external_url: input.externalUrl.trim() || null,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  revalidateMiniAppsPaths(id);
}

export async function regenerateApiKey(id: string): Promise<{ apiKey: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await assertModuleEnabled(workspaceId, "mini_apps");
  const supabase = await createClient();

  const apiKey = generateApiKey();
  await supabase
    .from("mini_apps")
    .update({ api_key_hash: hashApiKey(apiKey), api_key_last4: lastFour(apiKey), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  revalidateMiniAppsPaths(id);
  return { apiKey };
}

export async function deleteMiniApp(id: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await assertModuleEnabled(workspaceId, "mini_apps");
  const supabase = await createClient();

  await supabase.from("mini_apps").delete().eq("id", id).eq("workspace_id", workspaceId);
  revalidateMiniAppsPaths();
}

export async function updateMiniAppLeadStatus(leadId: string, status: MiniAppLeadStatus): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  const supabase = await createClient();

  const { data } = await supabase
    .from("mini_app_leads")
    .update({ status })
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .select("mini_app_id")
    .single();

  revalidateMiniAppsPaths(data?.mini_app_id as string | undefined);
}

/** Contact-only conversion — deliberately does NOT create an opportunity
 * (that's the separate "Mover a Pipeline" action below). Mirrors the same
 * upsert-by-phone shape createOpportunity uses for its own contact step
 * (src/lib/crm/actions.ts), without forcing a pipeline_item to exist. */
export async function convertMiniAppLeadToContact(leadId: string): Promise<{ contactId: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  const supabase = await createClient();

  const lead = await getMiniAppLeadDetail(workspaceId, leadId);
  if (!lead) throw new Error("Lead no encontrado.");
  if (lead.contactId) return { contactId: lead.contactId };

  const { data: contact, error } = await supabase
    .from("contacts")
    .upsert(
      {
        workspace_id: workspaceId,
        name: lead.nombre,
        phone: lead.whatsapp,
        source: "mini_app",
        custom_fields: { origen_app: lead.origenApp, ...lead.data },
      },
      { onConflict: "workspace_id,phone" },
    )
    .select("id")
    .single();
  if (error || !contact) throw new Error("No se pudo crear el contacto.");

  await supabase
    .from("mini_app_leads")
    .update({ contact_id: contact.id, status: "converted" })
    .eq("id", leadId)
    .eq("workspace_id", workspaceId);

  revalidateMiniAppsPaths(lead.miniAppId);
  return { contactId: contact.id as string };
}

/** Reuses createOpportunity() directly (src/lib/crm/actions.ts) — real
 * reuse, no re-implementation of the pipeline/contact-upsert logic. */
export async function moveMiniAppLeadToPipeline(leadId: string, stageId?: string): Promise<{ opportunityId: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  const supabase = await createClient();

  const lead = await getMiniAppLeadDetail(workspaceId, leadId);
  if (!lead) throw new Error("Lead no encontrado.");
  if (lead.opportunityId) return { opportunityId: lead.opportunityId };

  const { data: miniApp } = await supabase
    .from("mini_apps")
    .select("assigned_agent_id")
    .eq("id", lead.miniAppId)
    .maybeSingle();

  const { id: opportunityId } = await createOpportunity(
    {
      name: lead.nombre,
      phone: lead.whatsapp,
      email: "",
      company: "",
      jobTitle: "",
      source: "mini_app",
      title: `Lead — ${lead.nombre} (${lead.origenApp})`,
      value: 0,
      currency: "MXN",
      priority: "medium",
      probability: null,
      expectedCloseDate: null,
      ownerId: (miniApp?.assigned_agent_id as string | null) ?? null,
    },
    stageId,
  );

  await supabase
    .from("mini_app_leads")
    .update({ opportunity_id: opportunityId, status: "converted" })
    .eq("id", leadId)
    .eq("workspace_id", workspaceId);

  revalidateMiniAppsPaths(lead.miniAppId);
  return { opportunityId };
}

/** Requires the lead to already be converted to an Opportunity — avoids
 * inventing a separate "pending owner" concept for leads that aren't in the
 * pipeline yet (the UI disables this action until "Mover a Pipeline" runs). */
export async function assignMiniAppLeadAdvisor(leadId: string, ownerId: string | null): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");

  const lead = await getMiniAppLeadDetail(workspaceId, leadId);
  if (!lead) throw new Error("Lead no encontrado.");
  if (!lead.opportunityId) throw new Error("Primero mové este lead al Pipeline.");

  await bulkAssignOwner([lead.opportunityId], ownerId);
  revalidateMiniAppsPaths(lead.miniAppId);
}

/** Creates/opens the WhatsApp conversation thread and returns its id so the
 * caller can deep-link into Inbox — it does NOT auto-send a first message.
 * sendOutboundWhatsAppMessage (src/lib/messaging/send.ts) rejects any
 * outbound message with no prior inbound history (WhatsApp's 24h free-
 * session window; this app has no approved template-message support yet),
 * so a brand-new lead who never messaged in can't legally receive an
 * automatic opener — the human has to send the actual first message from
 * Inbox once WhatsApp allows it (a template, or once the lead replies).
 *
 * Returns `{error}` instead of throwing for the "no channel connected"
 * case — a thrown Error here reaches the client as a generic Next.js-
 * redacted "Server Components render" message in production builds
 * instead of the real text, a recurring gotcha in this project for any
 * anticipated failure that depends on an async/external lookup rather than
 * a plain synchronous validation (see [[growthlink-ai-agents-module]]'s
 * runSandboxTurn fix — same root cause, same fix shape). */
export async function startMiniAppLeadConversation(leadId: string): Promise<{ conversationId: string } | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  const supabase = await createClient();
  const memberId = await getCurrentMemberId(workspaceId);

  const lead = await getMiniAppLeadDetail(workspaceId, leadId);
  if (!lead) return { error: "Lead no encontrado." };

  let contactId = lead.contactId;
  if (!contactId) {
    const converted = await convertMiniAppLeadToContact(leadId);
    contactId = converted.contactId;
  }

  const businessNumber = await getDefaultOutboundBusinessNumber(supabase, workspaceId);
  if (!businessNumber) return { error: "Este workspace no tiene un canal de WhatsApp conectado todavía." };

  const conversationId = await getOrCreateOpenConversationForContact(supabase, workspaceId, contactId, businessNumber, memberId);

  await supabase
    .from("mini_app_leads")
    .update({ status: "contacted" })
    .eq("id", leadId)
    .eq("workspace_id", workspaceId)
    .eq("status", "new");

  revalidateMiniAppsPaths(lead.miniAppId);
  return { conversationId };
}
