import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ClientStatus = "en_onboarding" | "activo" | "pausado" | "archivado";
export type ClientContractStatus = "borrador" | "activo" | "vencido" | "renovado" | "cancelado";
export type ClientHealthLabel = "green" | "yellow" | "red";

export interface ClientContract {
  id: string;
  clientId: string;
  status: ClientContractStatus;
  startDate: string;
  endDate: string;
  durationMonths: number | null;
  totalValue: number | null;
  monthlyValue: number | null;
  amountPaid: number | null;
  currency: string;
  commissionModel: string | null;
  documentId: string | null;
  notes: string | null;
  createdAt: string;
}

const CONTRACT_SELECT =
  "id, client_id, status, start_date, end_date, duration_months, total_value, monthly_value, amount_paid, currency, commission_model, document_id, notes, created_at";

function mapContract(r: Record<string, unknown>): ClientContract {
  return {
    id: r.id as string,
    clientId: r.client_id as string,
    status: r.status as ClientContractStatus,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    durationMonths: r.duration_months as number | null,
    totalValue: r.total_value as number | null,
    monthlyValue: r.monthly_value as number | null,
    amountPaid: r.amount_paid as number | null,
    currency: r.currency as string,
    commissionModel: r.commission_model as string | null,
    documentId: r.document_id as string | null,
    notes: r.notes as string | null,
    createdAt: r.created_at as string,
  };
}

export interface ClientListItem {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatarUrl: string | null;
  company: string | null;
  profession: string | null;
  insurer: string | null;
  status: ClientStatus;
  linkedinProfileUrl: string | null;
  linkedinSalesNavigatorUrl: string | null;
  calendlyUrl: string | null;
  country: string | null;
  setterId: string | null;
  accountManagerId: string | null;
  trafficManagerId: string | null;
  healthScoreLabel: ClientHealthLabel | null;
  activeContract: ClientContract | null;
  citasCount: number;
  citasMesCount: number;
  polizasCount: number;
  polizasMesCount: number;
  tareasPendientesCount: number;
  createdAt: string;
}

/** Mismo patrón que getMiniAppsList (src/lib/miniApps/queries.ts): un select
 * principal + selects de conteo por client_id, agregados en JS con un Map —
 * a esta escala (decenas de clientes, no miles) es más simple que armar
 * vistas/RPCs de agregación y sigue el criterio ya usado en el resto del
 * proyecto para listados con KPIs derivados. */
export async function getClientsList(workspaceId: string): Promise<ClientListItem[]> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("clients")
    .select(
      "id, contact_id, profession, insurer, country, city, status, setter_id, account_manager_id, traffic_manager_id, linkedin_profile_url, linkedin_sales_navigator_url, calendly_url, health_score_label, created_at, contacts!clients_contact_id_fkey(name, company, avatar_url)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (!rows || rows.length === 0) return [];

  const clientIds = rows.map((r) => r.id as string);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: contracts }, { data: bookings }, { data: policies }, { data: tasks }] = await Promise.all([
    supabase.from("client_contracts").select(CONTRACT_SELECT).in("client_id", clientIds).order("start_date", { ascending: false }),
    supabase.from("bookings").select("client_id, start_time").eq("workspace_id", workspaceId).in("client_id", clientIds),
    supabase.from("policies").select("client_id, issue_date").eq("workspace_id", workspaceId).in("client_id", clientIds),
    supabase.from("tasks").select("client_id, status").eq("workspace_id", workspaceId).in("client_id", clientIds),
  ]);

  const activeContractByClient = new Map<string, ClientContract>();
  for (const row of contracts ?? []) {
    const clientId = row.client_id as string;
    if (activeContractByClient.has(clientId)) continue;
    if (row.status === "activo") activeContractByClient.set(clientId, mapContract(row));
  }

  const countBy = (source: { client_id: unknown }[] | null, predicate?: (r: Record<string, unknown>) => boolean) => {
    const map = new Map<string, number>();
    for (const row of source ?? []) {
      if (predicate && !predicate(row as Record<string, unknown>)) continue;
      const clientId = row.client_id as string;
      map.set(clientId, (map.get(clientId) ?? 0) + 1);
    }
    return map;
  };

  const citasByClient = countBy(bookings);
  const citasMesByClient = countBy(bookings, (r) => typeof r.start_time === "string" && r.start_time >= monthStart);
  const polizasByClient = countBy(policies);
  const polizasMesByClient = countBy(policies, (r) => typeof r.issue_date === "string" && r.issue_date >= monthStart);
  const tareasPendientesByClient = countBy(tasks, (r) => r.status !== "completed");

  return rows.map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      contactId: r.contact_id as string,
      contactName: (contact?.name as string | undefined) ?? "Sin nombre",
      contactAvatarUrl: (contact?.avatar_url as string | undefined) ?? null,
      company: (contact?.company as string | undefined) ?? null,
      profession: r.profession as string | null,
      insurer: r.insurer as string | null,
      status: r.status as ClientStatus,
      linkedinProfileUrl: r.linkedin_profile_url as string | null,
      linkedinSalesNavigatorUrl: r.linkedin_sales_navigator_url as string | null,
      calendlyUrl: r.calendly_url as string | null,
      country: r.country as string | null,
      setterId: r.setter_id as string | null,
      accountManagerId: r.account_manager_id as string | null,
      trafficManagerId: r.traffic_manager_id as string | null,
      healthScoreLabel: r.health_score_label as ClientHealthLabel | null,
      activeContract: activeContractByClient.get(r.id as string) ?? null,
      citasCount: citasByClient.get(r.id as string) ?? 0,
      citasMesCount: citasMesByClient.get(r.id as string) ?? 0,
      polizasCount: polizasByClient.get(r.id as string) ?? 0,
      polizasMesCount: polizasMesByClient.get(r.id as string) ?? 0,
      tareasPendientesCount: tareasPendientesByClient.get(r.id as string) ?? 0,
      createdAt: r.created_at as string,
    };
  });
}

export interface ClientProfile {
  id: string;
  workspaceId: string;
  contactId: string;
  contactName: string;
  contactAvatarUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  company: string | null;
  profession: string | null;
  insurer: string | null;
  country: string | null;
  city: string | null;
  status: ClientStatus;
  serviceType: string;
  setterId: string | null;
  accountManagerId: string | null;
  trafficManagerId: string | null;
  linkedinProfileUrl: string | null;
  linkedinSalesNavigatorUrl: string | null;
  calendlyUrl: string | null;
  healthScore: number | null;
  healthScoreLabel: ClientHealthLabel | null;
  createdAt: string;
}

export async function getClientProfile(workspaceId: string, clientId: string): Promise<ClientProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, workspace_id, contact_id, profession, insurer, country, city, status, service_type, setter_id, account_manager_id, traffic_manager_id, linkedin_profile_url, linkedin_sales_navigator_url, calendly_url, health_score, health_score_label, created_at, contacts!clients_contact_id_fkey(name, company, avatar_url, email, phone)",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;

  const contact = Array.isArray(data.contacts) ? data.contacts[0] : data.contacts;
  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    contactId: data.contact_id as string,
    contactName: (contact?.name as string | undefined) ?? "Sin nombre",
    contactAvatarUrl: (contact?.avatar_url as string | undefined) ?? null,
    contactEmail: (contact?.email as string | undefined) ?? null,
    contactPhone: (contact?.phone as string | undefined) ?? null,
    company: (contact?.company as string | undefined) ?? null,
    profession: data.profession as string | null,
    insurer: data.insurer as string | null,
    country: data.country as string | null,
    city: data.city as string | null,
    status: data.status as ClientStatus,
    serviceType: data.service_type as string,
    setterId: data.setter_id as string | null,
    accountManagerId: data.account_manager_id as string | null,
    trafficManagerId: data.traffic_manager_id as string | null,
    linkedinProfileUrl: data.linkedin_profile_url as string | null,
    linkedinSalesNavigatorUrl: data.linkedin_sales_navigator_url as string | null,
    calendlyUrl: data.calendly_url as string | null,
    healthScore: data.health_score as number | null,
    healthScoreLabel: data.health_score_label as ClientHealthLabel | null,
    createdAt: data.created_at as string,
  };
}

export async function getClientContracts(workspaceId: string, clientId: string): Promise<ClientContract[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_contracts")
    .select(CONTRACT_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("start_date", { ascending: false });
  return (data ?? []).map(mapContract);
}

export interface ClientAppointment {
  id: string;
  contactId: string | null;
  contactName: string | null;
  startTime: string;
  provider: string;
  status: string;
  attended: boolean | null;
  ownerId: string | null;
}

/** Pestaña Agenda — bookings.client_id ya trae la asociación (0125), nada se
 * carga a mano. "Fuente" se lee de `provider`, "Resultado" de `attended`
 * (show/no-show) hasta que exista un campo más rico — ver plan, sección
 * Alertas + Health Score. */
export async function getClientAppointments(workspaceId: string, clientId: string): Promise<ClientAppointment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, contact_id, start_time, provider, status, attended, owner_id, contacts(name)")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("start_time", { ascending: false });

  return (data ?? []).map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      contactId: r.contact_id as string | null,
      contactName: (contact?.name as string | undefined) ?? null,
      startTime: r.start_time as string,
      provider: r.provider as string,
      status: r.status as string,
      attended: r.attended as boolean | null,
      ownerId: r.owner_id as string | null,
    };
  });
}

export interface ClientPolicy {
  id: string;
  contactId: string;
  contactName: string | null;
  product: string;
  company: string;
  premium: number | null;
  premiumCurrency: string | null;
  commissionAmount: number | null;
  status: string;
  issueDate: string | null;
}

/** Pestaña Pólizas — reutiliza policies.client_id (0125), mismas filas que
 * ya administra el módulo Pólizas, filtradas nada más. */
export async function getClientPolicies(workspaceId: string, clientId: string): Promise<ClientPolicy[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("policies")
    .select("id, contact_id, product, company, premium, premium_currency, commission_amount, status, issue_date, contacts(name)")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false });

  return (data ?? []).map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      contactId: r.contact_id as string,
      contactName: (contact?.name as string | undefined) ?? null,
      product: r.product as string,
      company: r.company as string,
      premium: r.premium as number | null,
      premiumCurrency: r.premium_currency as string | null,
      commissionAmount: r.commission_amount as number | null,
      status: r.status as string,
      issueDate: r.issue_date as string | null,
    };
  });
}

export type ClientTaskOwnerSide = "client" | "growth_link" | null;

export interface ClientTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  ownerSide: ClientTaskOwnerSide;
  assignedTo: string | null;
  dueAt: string | null;
}

/** Pestaña Tareas — reutiliza tasks.client_id + tasks.owner_side (0125),
 * separadas en el shell ("Tareas del cliente" vs "Tareas Growth Link") por
 * ClientTasksBoard.tsx, no acá — esta función solo trae las filas. */
export async function getClientTasks(workspaceId: string, clientId: string): Promise<ClientTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, owner_side, assigned_to, due_at")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("due_at", { ascending: true, nullsFirst: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    status: r.status as string,
    priority: r.priority as string,
    ownerSide: r.owner_side as ClientTaskOwnerSide,
    assignedTo: r.assigned_to as string | null,
    dueAt: r.due_at as string | null,
  }));
}
