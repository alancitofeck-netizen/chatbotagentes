import "server-only";
import { createClient } from "@/lib/supabase/server";

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
        "id, workspace_id, name, description, template_key, slug, external_url, assigned_agent_id, allowed_origins, api_key_last4, status, created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", miniAppId)
      .maybeSingle(),
    getMemberNamesById(supabase, workspaceId),
  ]);
  if (!app) return null;

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
