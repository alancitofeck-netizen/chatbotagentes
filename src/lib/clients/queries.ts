import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildClientAlerts, type ClientAlertType, type ClientAlertTaskInput } from "@/lib/clients/alerts";

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
  healthScore: number | null;
  healthScoreLabel: ClientHealthLabel | null;
  activeContract: ClientContract | null;
  citasCount: number;
  citasMesCount: number;
  polizasCount: number;
  polizasMesCount: number;
  tareasPendientesCount: number;
  alertTypes: ClientAlertType[];
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
      "id, contact_id, profession, insurer, country, city, status, setter_id, account_manager_id, traffic_manager_id, linkedin_profile_url, linkedin_sales_navigator_url, calendly_url, health_score, health_score_label, created_at, contacts!clients_contact_id_fkey(name, company, avatar_url)",
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
    supabase.from("tasks").select("client_id, status, owner_side, due_at").eq("workspace_id", workspaceId).in("client_id", clientIds),
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

  // Última cita por cliente — para la alerta "sin citas recientes"
  // (ver alerts.ts, noRecentActivitySeverity). `bookings` ya viene sin
  // ordenar acá (se pide todo el historial para citasCount), así que se
  // resuelve el máximo en JS en vez de un segundo round-trip ordenado.
  const lastBookingByClient = new Map<string, string>();
  for (const row of bookings ?? []) {
    const clientId = row.client_id as string;
    const startTime = row.start_time as string;
    const current = lastBookingByClient.get(clientId);
    if (!current || startTime > current) lastBookingByClient.set(clientId, startTime);
  }

  // Tareas agrupadas (no solo el conteo) — buildClientAlerts necesita
  // owner_side/due_at para distinguir "vencida y a cargo del cliente" de
  // simplemente "pendiente".
  const tasksByClient = new Map<string, ClientAlertTaskInput[]>();
  for (const row of tasks ?? []) {
    const clientId = row.client_id as string;
    const list = tasksByClient.get(clientId) ?? [];
    list.push({ ownerSide: row.owner_side as ClientAlertTaskInput["ownerSide"], status: row.status as string, dueAt: row.due_at as string | null });
    tasksByClient.set(clientId, list);
  }

  return rows.map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    const id = r.id as string;
    const activeContract = activeContractByClient.get(id) ?? null;
    const alerts = buildClientAlerts({
      contract: activeContract,
      tasks: tasksByClient.get(id) ?? [],
      lastBookingAt: lastBookingByClient.get(id) ?? null,
      policiesThisMonthCount: polizasMesByClient.get(id) ?? 0,
    });
    return {
      id,
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
      healthScore: r.health_score as number | null,
      healthScoreLabel: r.health_score_label as ClientHealthLabel | null,
      activeContract,
      citasCount: citasByClient.get(id) ?? 0,
      citasMesCount: citasMesByClient.get(id) ?? 0,
      polizasCount: polizasByClient.get(id) ?? 0,
      polizasMesCount: polizasMesByClient.get(id) ?? 0,
      tareasPendientesCount: tareasPendientesByClient.get(id) ?? 0,
      alertTypes: alerts.map((a) => a.type),
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
  healthScoreUpdatedAt: string | null;
  createdAt: string;
}

export async function getClientProfile(workspaceId: string, clientId: string): Promise<ClientProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, workspace_id, contact_id, profession, insurer, country, city, status, service_type, setter_id, account_manager_id, traffic_manager_id, linkedin_profile_url, linkedin_sales_navigator_url, calendly_url, health_score, health_score_label, health_score_updated_at, created_at, contacts!clients_contact_id_fkey(name, company, avatar_url, email, phone)",
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
    healthScoreUpdatedAt: data.health_score_updated_at as string | null,
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
  policyNumber: string | null;
  product: string;
  company: string;
  premium: number | null;
  premiumCurrency: string | null;
  commissionAmount: number | null;
  status: string;
  issueDate: string | null;
  endDate: string | null;
}

/** Pestaña Pólizas — reutiliza policies.client_id (0125), mismas filas que
 * ya administra el módulo Pólizas, filtradas nada más. */
export async function getClientPolicies(workspaceId: string, clientId: string): Promise<ClientPolicy[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("policies")
    .select("id, contact_id, policy_number, product, company, premium, premium_currency, commission_amount, status, issue_date, end_date, contacts(name)")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false });

  return (data ?? []).map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      contactId: r.contact_id as string,
      contactName: (contact?.name as string | undefined) ?? null,
      policyNumber: r.policy_number as string | null,
      product: r.product as string,
      company: r.company as string,
      premium: r.premium as number | null,
      premiumCurrency: r.premium_currency as string | null,
      commissionAmount: r.commission_amount as number | null,
      status: r.status as string,
      issueDate: r.issue_date as string | null,
      endDate: r.end_date as string | null,
    };
  });
}

export interface ClientPolicyPayment {
  id: string;
  policyId: string;
  policyProduct: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: string;
}

/** "Próximos cierres" del panel lateral de Pólizas — cuotas pendientes de
 * las pólizas de este cliente (policy_payments, 0097_policy_payments.sql),
 * nunca inventadas: si no hay cronograma cargado para ninguna póliza, esto
 * devuelve vacío. */
export async function getClientUpcomingPolicyPayments(workspaceId: string, clientId: string, limit = 5): Promise<ClientPolicyPayment[]> {
  const supabase = await createClient();
  const { data: policyRows } = await supabase.from("policies").select("id, product").eq("workspace_id", workspaceId).eq("client_id", clientId);
  const policies = policyRows ?? [];
  if (policies.length === 0) return [];

  const productById = new Map(policies.map((p) => [p.id as string, p.product as string]));
  const { data } = await supabase
    .from("policy_payments")
    .select("id, policy_id, due_date, amount, currency, status")
    .in("policy_id", policies.map((p) => p.id as string))
    .eq("status", "pendiente")
    .order("due_date", { ascending: true })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    policyId: r.policy_id as string,
    policyProduct: productById.get(r.policy_id as string) ?? "—",
    dueDate: r.due_date as string,
    amount: r.amount as number,
    currency: r.currency as string,
    status: r.status as string,
  }));
}

export interface ClientAccess {
  id: string;
  platform: string;
  accountLabel: string;
  permission: string | null;
  expiresAt: string | null;
  status: "active" | "inactive";
  notes: string | null;
  createdAt: string;
}

export async function getClientAccess(workspaceId: string, clientId: string): Promise<ClientAccess[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_access")
    .select("id, platform, account_label, permission, expires_at, status, notes, created_at")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    platform: r.platform as string,
    accountLabel: r.account_label as string,
    permission: r.permission as string | null,
    expiresAt: r.expires_at as string | null,
    status: r.status as "active" | "inactive",
    notes: r.notes as string | null,
    createdAt: r.created_at as string,
  }));
}

export interface ClientContractPayment {
  id: string;
  contractId: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: "pendiente" | "pagado";
  paidAt: string | null;
  paymentMethod: string | null;
  documentId: string | null;
  notes: string | null;
}

export async function getClientContractPayments(workspaceId: string, contractId: string): Promise<ClientContractPayment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_contract_payments")
    .select("id, contract_id, due_date, amount, currency, status, paid_at, payment_method, document_id, notes")
    .eq("workspace_id", workspaceId)
    .eq("contract_id", contractId)
    .order("due_date", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    contractId: r.contract_id as string,
    dueDate: r.due_date as string,
    amount: r.amount as number,
    currency: r.currency as string,
    status: r.status as "pendiente" | "pagado",
    paidAt: r.paid_at as string | null,
    paymentMethod: r.payment_method as string | null,
    documentId: r.document_id as string | null,
    notes: r.notes as string | null,
  }));
}

export interface ClientNote {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
}

/** "Notas internas" del Contrato — notable_type='client' (no
 * 'client_contract') para que las notas sobrevivan a una renovación, mismo
 * mecanismo polimórfico que ya usan Pólizas/CRM/Tareas (public.notes). */
export async function getClientNotes(workspaceId: string, clientId: string): Promise<ClientNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, body, author_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("notable_type", "client")
    .eq("notable_id", clientId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((n) => ({ id: n.id as string, body: n.body as string, authorId: n.author_id as string | null, createdAt: n.created_at as string }));
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

export type ClientTimelineEventType = "booking" | "task_completed" | "policy" | "activity";

export interface ClientTimelineEvent {
  id: string;
  type: ClientTimelineEventType;
  label: string;
  detail: string | null;
  at: string;
  actorId: string | null;
}

/** Sección Timeline de Resumen — unión cronológica de bookings/tasks
 * completadas/policies (todas ya filtradas por client_id, 0125) más
 * audit_log (entity_type='client', entity_id=clients.id — eventos propios
 * del módulo, ver logActivity() en actions.ts). Se resuelve acá en JS en
 * vez de un UNION en SQL porque cada fuente tiene columnas y un "label" de
 * evento distintos — nombre del actor se resuelve en el caller (ya trae
 * getWorkspaceMembers para Setter/AM/TM, no duplicar el fetch acá). */
export async function getClientTimeline(workspaceId: string, clientId: string, limit = 30): Promise<ClientTimelineEvent[]> {
  const supabase = await createClient();
  const [{ data: bookings }, { data: tasks }, { data: policies }, { data: activity }] = await Promise.all([
    supabase.from("bookings").select("id, start_time, provider, contacts(name)").eq("workspace_id", workspaceId).eq("client_id", clientId),
    supabase
      .from("tasks")
      .select("id, title, completed_at")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .eq("status", "completed")
      .not("completed_at", "is", null),
    supabase.from("policies").select("id, product, company, issue_date").eq("workspace_id", workspaceId).eq("client_id", clientId).not("issue_date", "is", null),
    supabase.from("audit_log").select("id, action, metadata, created_at, actor_id").eq("workspace_id", workspaceId).eq("entity_type", "client").eq("entity_id", clientId),
  ]);

  const events: ClientTimelineEvent[] = [];

  for (const b of bookings ?? []) {
    const contact = Array.isArray(b.contacts) ? b.contacts[0] : b.contacts;
    events.push({
      id: `booking-${b.id}`,
      type: "booking",
      label: "Cita agendada",
      detail: [contact?.name as string | undefined, b.provider as string | undefined].filter(Boolean).join(" · ") || null,
      at: b.start_time as string,
      actorId: null,
    });
  }

  for (const t of tasks ?? []) {
    events.push({ id: `task-${t.id}`, type: "task_completed", label: "Tarea completada", detail: t.title as string, at: t.completed_at as string, actorId: null });
  }

  for (const p of policies ?? []) {
    events.push({
      id: `policy-${p.id}`,
      type: "policy",
      label: "Póliza emitida",
      detail: [p.product as string | undefined, p.company as string | undefined].filter(Boolean).join(" · ") || null,
      at: p.issue_date as string,
      actorId: null,
    });
  }

  const ACTIVITY_LABEL: Record<string, string> = {
    client_created: "Cliente creado",
    contract_renewed: "Contrato renovado",
    client_status_changed: "Estado actualizado",
    contract_updated: "Contrato actualizado",
  };
  for (const a of activity ?? []) {
    const action = a.action as string;
    const metadata = (a.metadata as Record<string, unknown>) ?? {};
    const detail =
      action === "client_status_changed"
        ? (STATUS_LABEL_ES[metadata.status as string] ?? (metadata.status as string) ?? null)
        : action === "contract_renewed"
          ? `Hasta ${metadata.endDate ?? "—"}`
          : null;
    events.push({ id: `activity-${a.id}`, type: "activity", label: ACTIVITY_LABEL[action] ?? action, detail, at: a.created_at as string, actorId: a.actor_id as string | null });
  }

  return events.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

const STATUS_LABEL_ES: Record<string, string> = { en_onboarding: "En onboarding", activo: "Activo", pausado: "Pausado", archivado: "Archivado" };
