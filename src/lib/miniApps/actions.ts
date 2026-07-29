"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
  getMiniAppVisitsCount,
  getContactMiniAppOrigins,
  type MiniAppLeadFilters,
  type MiniAppBranding,
  type MiniAppFieldConfig,
  type CalculadoraBrechaConfig,
} from "@/lib/miniApps/queries";
import { getWorkspaceMembersList } from "@/lib/settings/queries";
import {
  ingestMiniAppLeadFromHostedPage,
  appendMiniAppLeadQualification,
  MINI_APP_CONTACT_SOURCE,
  type IngestResult,
  type QualificationAnswerInput,
} from "@/lib/miniApps/ingest";
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

/** Powers ContactDetailPanel's "Origen del Lead" tab — not gated behind
 * assertModuleEnabled("mini_apps") deliberately: a contact's past mini-app
 * submissions stay visible even if the module is later disabled for this
 * workspace, same as any other historical CRM data. */
export async function getContactMiniAppOriginsAction(contactId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getContactMiniAppOrigins(workspaceId, contactId);
}

export async function getMiniAppVisitsCountAction(miniAppId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getMiniAppVisitsCount(workspaceId, miniAppId);
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
  config: MiniAppFieldConfig | CalculadoraBrechaConfig;
}

/** Resolves the assigned agent's display name once, under a real
 * authenticated session (getWorkspaceMembersList → workspace_member_names,
 * whose own is_workspace_member() check passes here) — cached into
 * config.assignedAgentName so the public hosted-page submission path can
 * read it straight from the mini_apps row via a service-role client,
 * without needing a second, auth-gated RPC call from an anonymous request
 * (see submitMiniAppLeadFromHostedPage's own comment for why that RPC
 * can't be called from there). Template-agnostic — just an object spread,
 * works identically regardless of which config shape it's handed. */
async function resolveConfigWithAgentName(
  workspaceId: string,
  assignedAgentId: string | null,
  config: MiniAppFieldConfig | CalculadoraBrechaConfig,
) {
  if (!assignedAgentId) return config;
  const members = await getWorkspaceMembersList(workspaceId);
  const agentName = members.find((m) => m.memberId === assignedAgentId)?.fullName;
  return agentName ? { ...config, assignedAgentName: agentName } : config;
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
  const config = await resolveConfigWithAgentName(workspaceId, input.assignedAgentId, input.config);

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
      config,
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
  config: MiniAppFieldConfig | CalculadoraBrechaConfig;
}

export async function updateMiniApp(id: string, input: UpdateMiniAppInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();
  const config = await resolveConfigWithAgentName(workspaceId, input.assignedAgentId, input.config);

  await supabase
    .from("mini_apps")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      assigned_agent_id: input.assignedAgentId,
      allowed_origins: input.allowedOrigins,
      external_url: input.externalUrl.trim() || null,
      status: input.status,
      config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  revalidateMiniAppsPaths(id);
}

/** Sets branding (color + logo URL) — a separate action from updateMiniApp
 * because the logo upload (see LogoCropDialog.tsx) needs the mini app's
 * real `id` for its Storage path, which only exists after createMiniApp
 * has already run; the wizard's "Publicar" step calls createMiniApp first,
 * then uploads the logo, then calls this with the resulting public URL. */
export async function updateMiniAppBranding(id: string, branding: MiniAppBranding): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");
  const supabase = await createClient();

  await supabase
    .from("mini_apps")
    .update({ branding, updated_at: new Date().toISOString() })
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
        source: MINI_APP_CONTACT_SOURCE,
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
      source: MINI_APP_CONTACT_SOURCE,
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

/** Submission path for the Growth-Link-hosted public page
 * (src/app/apps/[slug]/) — deliberately NOT gated by requireActiveWorkspace
 * (the caller is an anonymous visitor, not a logged-in member) and doesn't
 * require the API key the public Route Handler needs (see the comment on
 * resolveAuthorizedMiniApp in ingest.ts for why). If the mini app has no
 * `agente` in the submitted payload, defaults it to the assigned advisor's
 * name cached in `config.assignedAgentName` at creation/update time
 * (createMiniApp/updateMiniApp resolve it under a real authenticated
 * session, where workspace_member_names' own is_workspace_member() check
 * passes — that RPC would return nothing called from here, since a
 * service-role request has no auth.uid() for it to match against). */
export async function submitMiniAppLeadFromHostedPage(slug: string, payload: Record<string, unknown>): Promise<IngestResult> {
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase.from("mini_apps").select("config").eq("slug", slug).maybeSingle();

  const cachedAgentName = (app?.config as { assignedAgentName?: string } | null)?.assignedAgentName;
  const agente = typeof payload.agente === "string" && payload.agente ? payload.agente : cachedAgentName;

  const headerList = await headers();
  return ingestMiniAppLeadFromHostedPage(
    slug,
    { ...payload, agente },
    headerList.get("x-forwarded-for"),
    headerList.get("user-agent"),
  );
}

/** Appends the "calificación de lead" answers (asked during the results
 * reveal, after submitMiniAppLeadFromHostedPage already created the lead)
 * onto that same lead — fire-and-forget from the client, same posture as
 * the visit-tracking fetch: never blocks the reveal, never surfaces an
 * error to the visitor. */
export async function submitMiniAppLeadQualificationFromHostedPage(leadId: string, answers: QualificationAnswerInput): Promise<void> {
  await appendMiniAppLeadQualification(leadId, answers);
}
