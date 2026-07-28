import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { DEFAULT_ANNUAL_RETURN_RATE_PCT } from "@/lib/miniApps/financialEngine";
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from "@/lib/miniApps/paletteEngine";
import { templateKeysForCategory, type MiniAppTemplateCategory } from "@/lib/miniApps/templateCatalog";

export type MiniAppTemplateKey = "simulador_retiro";
export type MiniAppStatus = "active" | "inactive";
export type MiniAppLeadStatus = "new" | "contacted" | "converted" | "discarded";

export interface MiniAppListItem {
  id: string;
  name: string;
  description: string | null;
  templateKey: MiniAppTemplateKey;
  slug: string;
  status: MiniAppStatus;
  assignedAgentName: string | null;
  leadsCount: number;
  lastLeadAt: string | null;
  createdAt: string;
}

export interface MiniAppDetail {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  templateKey: MiniAppTemplateKey;
  slug: string;
  externalUrl: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  allowedOrigins: string[];
  apiKeyLast4: string;
  status: MiniAppStatus;
  branding: MiniAppBranding;
  config: MiniAppFieldConfig;
  createdAt: string;
}

export interface MiniAppLeadRow {
  id: string;
  origenApp: string;
  agente: string | null;
  nombre: string;
  whatsapp: string;
  fecha: string;
  status: MiniAppLeadStatus;
  contactId: string | null;
  opportunityId: string | null;
}

export interface MiniAppLeadDetail extends MiniAppLeadRow {
  miniAppId: string;
  consentimiento: boolean;
  consentimientoFecha: string;
  receivedAt: string;
  data: Record<string, unknown>;
}

/** workspace_member_names (0003_inbox.sql) resolves member -> display name;
 * reused here the same way settings/queries.ts's getWorkspaceMembersList does. */
async function getMemberNamesById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  return new Map(
    ((data ?? []) as { member_id: string; full_name: string }[]).map((r) => [r.member_id, r.full_name]),
  );
}

export async function getMiniAppsList(workspaceId: string): Promise<MiniAppListItem[]> {
  const supabase = await createClient();
  const [{ data: apps }, memberNames] = await Promise.all([
    supabase
      .from("mini_apps")
      .select("id, name, description, template_key, slug, status, assigned_agent_id, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getMemberNamesById(supabase, workspaceId),
  ]);
  if (!apps || apps.length === 0) return [];

  const { data: leadStats } = await supabase
    .from("mini_app_leads")
    .select("mini_app_id, received_at")
    .eq("workspace_id", workspaceId);

  const statsByApp = new Map<string, { count: number; lastLeadAt: string | null }>();
  for (const row of leadStats ?? []) {
    const key = row.mini_app_id as string;
    const current = statsByApp.get(key) ?? { count: 0, lastLeadAt: null };
    current.count += 1;
    const receivedAt = row.received_at as string;
    if (!current.lastLeadAt || receivedAt > current.lastLeadAt) current.lastLeadAt = receivedAt;
    statsByApp.set(key, current);
  }

  return apps.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    description: a.description as string | null,
    templateKey: a.template_key as MiniAppTemplateKey,
    slug: a.slug as string,
    status: a.status as MiniAppStatus,
    assignedAgentName: a.assigned_agent_id ? (memberNames.get(a.assigned_agent_id as string) ?? null) : null,
    leadsCount: statsByApp.get(a.id as string)?.count ?? 0,
    lastLeadAt: statsByApp.get(a.id as string)?.lastLeadAt ?? null,
    createdAt: a.created_at as string,
  }));
}

export async function getMiniAppDetail(workspaceId: string, miniAppId: string): Promise<MiniAppDetail | null> {
  const supabase = await createClient();
  const [{ data: app }, memberNames] = await Promise.all([
    supabase
      .from("mini_apps")
      .select(
        "id, workspace_id, name, description, template_key, slug, external_url, assigned_agent_id, allowed_origins, api_key_last4, status, branding, config, created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", miniAppId)
      .maybeSingle(),
    getMemberNamesById(supabase, workspaceId),
  ]);
  if (!app) return null;

  const branding = (app.branding as Partial<MiniAppBranding>) ?? {};
  const config = (app.config as Partial<MiniAppFieldConfig>) ?? {};

  return {
    id: app.id as string,
    workspaceId: app.workspace_id as string,
    name: app.name as string,
    description: app.description as string | null,
    templateKey: app.template_key as MiniAppTemplateKey,
    slug: app.slug as string,
    externalUrl: app.external_url as string | null,
    assignedAgentId: app.assigned_agent_id as string | null,
    assignedAgentName: app.assigned_agent_id ? (memberNames.get(app.assigned_agent_id as string) ?? null) : null,
    allowedOrigins: (app.allowed_origins as string[]) ?? [],
    apiKeyLast4: app.api_key_last4 as string,
    status: app.status as MiniAppStatus,
    branding: {
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      secondaryColor: branding.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
    },
    config: {
      annualReturnRatePct: config.annualReturnRatePct ?? DEFAULT_ANNUAL_RETURN_RATE_PCT,
      showIngresoActual: config.showIngresoActual ?? true,
      fieldLabels: config.fieldLabels ?? {},
      assignedAgentName: config.assignedAgentName,
    },
    createdAt: app.created_at as string,
  };
}

export interface MiniAppLeadFilters {
  status?: MiniAppLeadStatus;
  agente?: string;
  from?: string;
  to?: string;
}

export async function getMiniAppLeads(
  workspaceId: string,
  miniAppId: string,
  filters?: MiniAppLeadFilters,
): Promise<MiniAppLeadRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("mini_app_leads")
    .select("id, origen_app, agente, nombre, whatsapp, fecha, status, contact_id, opportunity_id")
    .eq("workspace_id", workspaceId)
    .eq("mini_app_id", miniAppId)
    .order("received_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.agente) query = query.eq("agente", filters.agente);
  if (filters?.from) query = query.gte("fecha", filters.from);
  if (filters?.to) query = query.lte("fecha", filters.to);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    origenApp: r.origen_app as string,
    agente: r.agente as string | null,
    nombre: r.nombre as string,
    whatsapp: r.whatsapp as string,
    fecha: r.fecha as string,
    status: r.status as MiniAppLeadStatus,
    contactId: r.contact_id as string | null,
    opportunityId: r.opportunity_id as string | null,
  }));
}

export async function getMiniAppLeadDetail(workspaceId: string, leadId: string): Promise<MiniAppLeadDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select(
      "id, mini_app_id, origen_app, agente, nombre, whatsapp, fecha, consentimiento, consentimiento_fecha, received_at, data, status, contact_id, opportunity_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", leadId)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id as string,
    miniAppId: data.mini_app_id as string,
    origenApp: data.origen_app as string,
    agente: data.agente as string | null,
    nombre: data.nombre as string,
    whatsapp: data.whatsapp as string,
    fecha: data.fecha as string,
    consentimiento: data.consentimiento as boolean,
    consentimientoFecha: data.consentimiento_fecha as string,
    receivedAt: data.received_at as string,
    data: (data.data as Record<string, unknown>) ?? {},
    status: data.status as MiniAppLeadStatus,
    contactId: data.contact_id as string | null,
    opportunityId: data.opportunity_id as string | null,
  };
}

/** Leads-by-day for the Analíticas tab, bucketed by `fecha`'s calendar day
 * (UTC — same simplicity CRM Analytics' own day-bucketing uses). */
export async function getMiniAppLeadsByDay(
  workspaceId: string,
  miniAppId: string,
  rangeStartISO: string,
  rangeEndISO: string,
): Promise<{ date: string; count: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select("fecha")
    .eq("workspace_id", workspaceId)
    .eq("mini_app_id", miniAppId)
    .gte("fecha", rangeStartISO)
    .lte("fecha", rangeEndISO);

  const countsByDay = new Map<string, number>();
  for (const row of data ?? []) {
    const day = (row.fecha as string).slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }
  return [...countsByDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getMiniAppVisitsCount(workspaceId: string, miniAppId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("mini_app_visits")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("mini_app_id", miniAppId);
  return count ?? 0;
}

export interface MiniAppBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export interface MiniAppFieldConfig {
  annualReturnRatePct: number;
  showIngresoActual: boolean;
  fieldLabels: Partial<Record<"edad" | "edadRetiro" | "ahorroMensual" | "ingresoActual", string>>;
  assignedAgentName?: string;
}

export interface PublicMiniAppView {
  slug: string;
  name: string;
  description: string | null;
  templateKey: MiniAppTemplateKey;
  branding: MiniAppBranding;
  config: MiniAppFieldConfig;
}

/** Public-safe projection for the Growth-Link-hosted page
 * (src/app/apps/[slug]/) — always via createServiceRoleClient() (no
 * session for an anonymous visitor), and the select list is deliberately
 * narrow: never api_key_hash, allowed_origins, assigned_agent_id, or
 * workspace_id. Returns null for a missing slug or an inactive mini app
 * (the page treats both as notFound()). */
export async function getPublicMiniAppBySlug(slug: string): Promise<PublicMiniAppView | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("mini_apps")
    .select("slug, name, description, template_key, status, branding, config")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "active") return null;

  const branding = (data.branding as Partial<MiniAppBranding>) ?? {};
  const config = (data.config as Partial<MiniAppFieldConfig>) ?? {};

  return {
    slug: data.slug as string,
    name: data.name as string,
    description: data.description as string | null,
    templateKey: data.template_key as MiniAppTemplateKey,
    branding: {
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      secondaryColor: branding.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
    },
    config: {
      annualReturnRatePct: config.annualReturnRatePct ?? DEFAULT_ANNUAL_RETURN_RATE_PCT,
      showIngresoActual: config.showIngresoActual ?? true,
      fieldLabels: config.fieldLabels ?? {},
      assignedAgentName: config.assignedAgentName,
    },
  };
}

// ---------------------------------------------------------------------------
// Contactos de Apps — app-origin resolution. Lives here (not
// contacts/queries.ts) so the contacts module never needs to know mini_apps'
// schema; mirrors the existing tagId pre-resolve pattern getContactList
// already uses for tags.
// ---------------------------------------------------------------------------

export interface AppContactFilter {
  category?: MiniAppTemplateCategory;
  miniAppId?: string;
}

/** Resolves which contact_ids have >=1 mini_app_leads row matching the given
 * category/app filter. Deliberately NOT `contacts.source = 'mini_app'` — a
 * contact whose first touch was a mini app but who later also messaged in
 * over WhatsApp (or vice-versa) must still show up here, and `source` only
 * ever reflects whichever channel touched the contact FIRST (linkToContact
 * in ingest.ts uses ignoreDuplicates specifically so an existing contact's
 * source is never overwritten) — so filtering by source would silently drop
 * contacts "Contactos de Apps" is supposed to surface. */
export async function getContactIdsForAppOrigin(workspaceId: string, filter: AppContactFilter): Promise<string[]> {
  const supabase = await createClient();

  let miniAppIds: string[] | null = null;
  if (filter.miniAppId) {
    miniAppIds = [filter.miniAppId];
  } else if (filter.category) {
    const keys = templateKeysForCategory(filter.category);
    if (keys.length === 0) return [];
    const { data } = await supabase.from("mini_apps").select("id").eq("workspace_id", workspaceId).in("template_key", keys);
    miniAppIds = (data ?? []).map((r) => r.id as string);
    if (miniAppIds.length === 0) return [];
  }

  let query = supabase.from("mini_app_leads").select("contact_id").eq("workspace_id", workspaceId).not("contact_id", "is", null);
  if (miniAppIds) query = query.in("mini_app_id", miniAppIds);

  const { data } = await query;
  return Array.from(new Set((data ?? []).map((r) => r.contact_id as string)));
}

export interface ContactMiniAppOrigin {
  leadId: string;
  miniAppId: string;
  miniAppName: string;
  miniAppSlug: string;
  templateKey: MiniAppTemplateKey;
  receivedAt: string;
  data: Record<string, unknown>;
  durationSeconds: number | null;
}

/** Powers ContactDetailPanel's "Origen del Lead" tab — every mini-app
 * submission this contact ever made, most recent first, fully generic
 * (reads whichever fields happen to be in each lead's `data` jsonb — no
 * per-template field names hardcoded here). */
export async function getContactMiniAppOrigins(workspaceId: string, contactId: string): Promise<ContactMiniAppOrigin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select("id, mini_app_id, received_at, data, duration_seconds, mini_apps(name, slug, template_key)")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("received_at", { ascending: false });

  return (data ?? []).map((r) => {
    const app = Array.isArray(r.mini_apps) ? r.mini_apps[0] : r.mini_apps;
    return {
      leadId: r.id as string,
      miniAppId: r.mini_app_id as string,
      miniAppName: (app?.name as string | undefined) ?? "Mini app eliminada",
      miniAppSlug: (app?.slug as string | undefined) ?? "",
      templateKey: (app?.template_key as MiniAppTemplateKey | undefined) ?? "simulador_retiro",
      receivedAt: r.received_at as string,
      data: (r.data as Record<string, unknown>) ?? {},
      durationSeconds: (r.duration_seconds as number | null) ?? null,
    };
  });
}
