import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
  linkedWorkspaceId: string | null;
  contactId: string | null;
  contactName: string;
  contactAvatarUrl: string | null;
  contactEmail: string | null;
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

export interface RealAdvisorWorkspace {
  workspaceId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  workspaceCreatedAt: string;
}

/** Fuente de verdad de "quién es asesor de Growth Link": workspaces reales
 * (cada asesor que se registró tiene el suyo, provisionDefaultWorkspaceIfNeeded)
 * — nunca un contacto fabricado. Excluye el/los workspace(s) de cualquier
 * platform_admin (vos) — ese es tu propio workspace, no un asesor. Mismo
 * criterio de resolución de "usuario principal" (primer miembro por
 * created_at) + auth.admin.getUserById que ya usa getAllWorkspacesForSupervision
 * (src/lib/platform/queries.ts) para la tabla "Agentes" — deliberadamente NO
 * se reutiliza esa función directa porque trae leads/conversaciones/
 * integraciones que esta ficha no necesita (esos datos son del CRM del
 * asesor, no de la administración de Growth Link sobre el asesor). */
export async function getRealAdvisorWorkspaces(): Promise<RealAdvisorWorkspace[]> {
  const supabase = await createClient();
  const [{ data: workspaces }, { data: members }, { data: platformAdmins }] = await Promise.all([
    supabase.from("workspaces").select("id, created_at").order("created_at", { ascending: true }),
    supabase.from("workspace_members").select("workspace_id, user_id, created_at").order("created_at", { ascending: true }),
    supabase.from("platform_admins").select("user_id"),
  ]);
  if (!workspaces) return [];

  const platformAdminIds = new Set((platformAdmins ?? []).map((p) => p.user_id as string));
  const primaryUserByWorkspace = new Map<string, string>();
  for (const m of members ?? []) {
    const wid = m.workspace_id as string;
    if (!primaryUserByWorkspace.has(wid)) primaryUserByWorkspace.set(wid, m.user_id as string);
  }

  const realWorkspaces = workspaces.filter((w) => {
    const primaryUserId = primaryUserByWorkspace.get(w.id as string);
    return primaryUserId && !platformAdminIds.has(primaryUserId);
  });

  const serviceClient = createServiceRoleClient();
  const userInfoByWorkspace = new Map<string, { name: string; email: string; avatarUrl: string | null }>();
  await Promise.all(
    realWorkspaces.map(async (w) => {
      const primaryUserId = primaryUserByWorkspace.get(w.id as string)!;
      const { data } = await serviceClient.auth.admin.getUserById(primaryUserId);
      if (data?.user) {
        userInfoByWorkspace.set(w.id as string, {
          name: (data.user.user_metadata?.full_name as string | undefined) || data.user.email || "—",
          email: data.user.email ?? "—",
          avatarUrl: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
        });
      }
    }),
  );

  return realWorkspaces.map((w) => {
    const info = userInfoByWorkspace.get(w.id as string);
    return {
      workspaceId: w.id as string,
      name: info?.name ?? "—",
      email: info?.email ?? "—",
      avatarUrl: info?.avatarUrl ?? null,
      workspaceCreatedAt: w.created_at as string,
    };
  });
}

/** Da de alta la ficha administrativa (fila `clients`, todo vacío salvo el
 * ancla `linked_workspace_id`) para cualquier asesor real que todavía no la
 * tenga — para que la lista de Asesores nunca dependa de que vos crees la
 * tarjeta a mano (punto explícito del pedido). No fabrica NINGÚN dato: la
 * fila arranca en los defaults de la tabla (status 'en_onboarding', sin
 * contrato/setter/health score) hasta que se cargue algo real. */
async function ensureAdvisorRecordsExist(workspaceId: string, advisors: RealAdvisorWorkspace[]): Promise<void> {
  if (advisors.length === 0) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("clients").select("linked_workspace_id").eq("workspace_id", workspaceId).not("linked_workspace_id", "is", null);
  const existingIds = new Set((existing ?? []).map((r) => r.linked_workspace_id as string));
  const missing = advisors.filter((a) => !existingIds.has(a.workspaceId));
  if (missing.length === 0) return;
  await supabase.from("clients").insert(missing.map((a) => ({ workspace_id: workspaceId, linked_workspace_id: a.workspaceId })));
}

/** Mismo patrón que getMiniAppsList (src/lib/miniApps/queries.ts): un select
 * principal + selects de conteo por client_id, agregados en JS con un Map —
 * a esta escala (decenas de clientes, no miles) es más simple que armar
 * vistas/RPCs de agregación y sigue el criterio ya usado en el resto del
 * proyecto para listados con KPIs derivados. La identidad (nombre/foto/
 * email) ya no sale de un contacto fabricado — sale de getRealAdvisorWorkspaces. */
export async function getClientsList(workspaceId: string): Promise<ClientListItem[]> {
  const supabase = await createClient();

  const advisors = await getRealAdvisorWorkspaces();
  await ensureAdvisorRecordsExist(workspaceId, advisors);
  const advisorByWorkspace = new Map(advisors.map((a) => [a.workspaceId, a]));

  const { data: rows } = await supabase
    .from("clients")
    .select(
      "id, contact_id, linked_workspace_id, profession, insurer, country, city, status, setter_id, account_manager_id, traffic_manager_id, linkedin_profile_url, linkedin_sales_navigator_url, calendly_url, health_score, health_score_label, created_at, contacts!clients_contact_id_fkey(name, company, avatar_url)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (!rows || rows.length === 0) return [];

  const clientIds = rows.map((r) => r.id as string);
  const linkedWorkspaceIds = rows.map((r) => r.linked_workspace_id as string | null).filter((id): id is string => !!id);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // bookings/policies se leen del workspace REAL de cada asesor (en lote,
  // un solo round-trip para los ~8) — citas/pólizas ya no dependen de que
  // alguien las etiquete a mano en tu workspace. tasks se queda como tu
  // to-do interno (client_id, ver Tareas), eso sí sigue siendo tuyo.
  const [{ data: contracts }, { data: bookings }, { data: policies }, { data: tasks }] = await Promise.all([
    supabase.from("client_contracts").select(CONTRACT_SELECT).in("client_id", clientIds).order("start_date", { ascending: false }),
    linkedWorkspaceIds.length > 0
      ? supabase.from("bookings").select("workspace_id, start_time").in("workspace_id", linkedWorkspaceIds)
      : Promise.resolve({ data: [] }),
    linkedWorkspaceIds.length > 0
      ? supabase.from("policies").select("workspace_id, issue_date").in("workspace_id", linkedWorkspaceIds)
      : Promise.resolve({ data: [] }),
    supabase.from("tasks").select("client_id, status, owner_side, due_at").eq("workspace_id", workspaceId).in("client_id", clientIds),
  ]);

  const activeContractByClient = new Map<string, ClientContract>();
  for (const row of contracts ?? []) {
    const clientId = row.client_id as string;
    if (activeContractByClient.has(clientId)) continue;
    if (row.status === "activo") activeContractByClient.set(clientId, mapContract(row));
  }

  const countBy = (source: { workspace_id: unknown }[] | null, predicate?: (r: Record<string, unknown>) => boolean) => {
    const map = new Map<string, number>();
    for (const row of source ?? []) {
      if (predicate && !predicate(row as Record<string, unknown>)) continue;
      const wsId = row.workspace_id as string;
      map.set(wsId, (map.get(wsId) ?? 0) + 1);
    }
    return map;
  };

  const citasByWorkspace = countBy(bookings);
  const citasMesByWorkspace = countBy(bookings, (r) => typeof r.start_time === "string" && r.start_time >= monthStart);
  const polizasByWorkspace = countBy(policies);
  const polizasMesByWorkspace = countBy(policies, (r) => typeof r.issue_date === "string" && r.issue_date >= monthStart);

  const countByClientId = (source: { client_id: unknown }[] | null, predicate?: (r: Record<string, unknown>) => boolean) => {
    const map = new Map<string, number>();
    for (const row of source ?? []) {
      if (predicate && !predicate(row as Record<string, unknown>)) continue;
      const clientId = row.client_id as string;
      map.set(clientId, (map.get(clientId) ?? 0) + 1);
    }
    return map;
  };
  const tareasPendientesByClient = countByClientId(tasks, (r) => r.status !== "completed");

  // Última cita por workspace — para la alerta "sin citas recientes" (ver
  // alerts.ts, noRecentActivitySeverity). `bookings` ya viene sin ordenar
  // acá (se pide todo el historial para citasCount), así que se resuelve
  // el máximo en JS en vez de un segundo round-trip ordenado.
  const lastBookingByWorkspace = new Map<string, string>();
  for (const row of bookings ?? []) {
    const wsId = row.workspace_id as string;
    const startTime = row.start_time as string;
    const current = lastBookingByWorkspace.get(wsId);
    if (!current || startTime > current) lastBookingByWorkspace.set(wsId, startTime);
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
    const linkedWorkspaceId = r.linked_workspace_id as string | null;
    const advisor = linkedWorkspaceId ? advisorByWorkspace.get(linkedWorkspaceId) : undefined;
    const activeContract = activeContractByClient.get(id) ?? null;
    const citasMesCount = linkedWorkspaceId ? (citasMesByWorkspace.get(linkedWorkspaceId) ?? 0) : 0;
    const polizasMesCount = linkedWorkspaceId ? (polizasMesByWorkspace.get(linkedWorkspaceId) ?? 0) : 0;
    const alerts = buildClientAlerts({
      contract: activeContract,
      tasks: tasksByClient.get(id) ?? [],
      lastBookingAt: (linkedWorkspaceId ? lastBookingByWorkspace.get(linkedWorkspaceId) : null) ?? null,
      policiesThisMonthCount: polizasMesCount,
    });
    return {
      id,
      linkedWorkspaceId,
      contactId: r.contact_id as string | null,
      contactName: advisor?.name ?? (contact?.name as string | undefined) ?? "Sin nombre",
      contactAvatarUrl: advisor?.avatarUrl ?? (contact?.avatar_url as string | undefined) ?? null,
      contactEmail: advisor?.email ?? null,
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
      citasCount: linkedWorkspaceId ? (citasByWorkspace.get(linkedWorkspaceId) ?? 0) : 0,
      citasMesCount,
      polizasCount: linkedWorkspaceId ? (polizasByWorkspace.get(linkedWorkspaceId) ?? 0) : 0,
      polizasMesCount,
      tareasPendientesCount: tareasPendientesByClient.get(id) ?? 0,
      alertTypes: alerts.map((a) => a.type),
      createdAt: r.created_at as string,
    };
  });
}

export interface ClientProfile {
  id: string;
  workspaceId: string;
  linkedWorkspaceId: string | null;
  contactId: string | null;
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
  /** Texto exacto esperado en la columna "Asesor" de la hoja de Agenda —
   * ver UpdateClientInput.sheetAlias (clients/actions.ts). */
  sheetAlias: string | null;
  createdAt: string;
}

/** Resuelve nombre/email/foto real del asesor dueño de `linkedWorkspaceId`
 * (primer miembro de ese workspace + auth.admin.getUserById) — variante de
 * fila única de la misma resolución que getRealAdvisorWorkspaces hace en
 * lote para la lista; separada porque acá alcanza con un solo workspace, no
 * hace falta traer los otros 7. */
async function resolveAdvisorIdentity(linkedWorkspaceId: string): Promise<{ name: string; email: string; avatarUrl: string | null } | null> {
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", linkedWorkspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient.auth.admin.getUserById(member.user_id as string);
  if (!data?.user) return null;
  return {
    name: (data.user.user_metadata?.full_name as string | undefined) || data.user.email || "—",
    email: data.user.email ?? "—",
    avatarUrl: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
  };
}

/** Resuelve el workspace real detrás de una ficha administrativa — usado por
 * toda función que necesita leer la ACTIVIDAD real del asesor (Agenda/
 * Pólizas/KPIs/Operación/Tareas), a diferencia de getClientProfile que lee
 * la ficha en sí. RLS de bookings/policies/tasks/contacts/conversations ya
 * te deja LEER cualquier workspace real como platform admin (core.
 * is_workspace_member tiene el carve-out is_platform_admin()) — nada
 * especial hace falta acá más que saber a cuál workspace mirar. */
export async function getLinkedWorkspaceId(workspaceId: string, clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("linked_workspace_id").eq("workspace_id", workspaceId).eq("id", clientId).maybeSingle();
  return (data?.linked_workspace_id as string | null) ?? null;
}

export async function getClientProfile(workspaceId: string, clientId: string): Promise<ClientProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, workspace_id, contact_id, linked_workspace_id, profession, insurer, country, city, status, service_type, setter_id, account_manager_id, traffic_manager_id, linkedin_profile_url, linkedin_sales_navigator_url, calendly_url, health_score, health_score_label, health_score_updated_at, sheet_alias, created_at, contacts!clients_contact_id_fkey(name, company, avatar_url, email, phone)",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;

  const contact = Array.isArray(data.contacts) ? data.contacts[0] : data.contacts;
  const linkedWorkspaceId = data.linked_workspace_id as string | null;
  const advisor = linkedWorkspaceId ? await resolveAdvisorIdentity(linkedWorkspaceId) : null;
  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    linkedWorkspaceId,
    contactId: data.contact_id as string | null,
    contactName: advisor?.name ?? (contact?.name as string | undefined) ?? "Sin nombre",
    contactAvatarUrl: advisor?.avatarUrl ?? (contact?.avatar_url as string | undefined) ?? null,
    contactEmail: advisor?.email ?? (contact?.email as string | undefined) ?? null,
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
    sheetAlias: data.sheet_alias as string | null,
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

export type BookingFuente = "linkedin" | "referido" | "meta_ads" | "otro";
export type BookingResultado = "interesado" | "calificado" | "sin_respuesta" | "no_interesado";

export interface ClientAppointment {
  id: string;
  contactId: string | null;
  contactName: string | null;
  startTime: string;
  provider: string;
  status: string;
  attended: boolean | null;
  ownerId: string | null;
  fuente: BookingFuente | null;
  campana: string | null;
  resultado: BookingResultado | null;
}

/** Pestaña Agenda — lee las citas REALES del workspace del asesor (no
 * bookings.client_id, que exigía cargarlas a mano dentro de tu propio
 * workspace y nunca se completaba solo). fuente/campana/resultado (0127)
 * siguen siendo carga manual tuya, cita por cita, pero ahora anotando la
 * cita real del asesor en vez de una fabricada. */
export async function getClientAppointments(workspaceId: string, clientId: string): Promise<ClientAppointment[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, contact_id, start_time, provider, status, attended, owner_id, fuente, campana, resultado, contacts(name)")
    .eq("workspace_id", linkedWorkspaceId)
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
      fuente: r.fuente as BookingFuente | null,
      campana: r.campana as string | null,
      resultado: r.resultado as BookingResultado | null,
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

/** Pestaña Pólizas — lee las pólizas REALES que el asesor cargó en su propio
 * módulo Pólizas (mismo criterio que getClientAppointments: workspace real,
 * no policies.client_id tageado a mano). */
export async function getClientPolicies(workspaceId: string, clientId: string): Promise<ClientPolicy[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("policies")
    .select("id, contact_id, policy_number, product, company, premium, premium_currency, commission_amount, status, issue_date, end_date, contacts(name)")
    .eq("workspace_id", linkedWorkspaceId)
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
  description: string | null;
  status: string;
  priority: string;
  ownerSide: ClientTaskOwnerSide;
  assignedTo: string | null;
  dueAt: string | null;
  completedAt: string | null;
  relatedArea: string | null;
  createdAt: string;
}

/** Pestaña Tareas — reutiliza tasks.client_id + tasks.owner_side (0125) y
 * tasks.related_area (0128, carga manual, ver esa migración) — esta función
 * solo trae las filas, la vista (tabla filtrable + tiles) vive en la UI. */
export async function getClientTasks(workspaceId: string, clientId: string): Promise<ClientTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, owner_side, assigned_to, due_at, completed_at, related_area, created_at")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("due_at", { ascending: true, nullsFirst: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    description: r.description as string | null,
    status: r.status as string,
    priority: r.priority as string,
    ownerSide: r.owner_side as ClientTaskOwnerSide,
    assignedTo: r.assigned_to as string | null,
    dueAt: r.due_at as string | null,
    completedAt: r.completed_at as string | null,
    relatedArea: r.related_area as string | null,
    createdAt: r.created_at as string,
  }));
}

export interface ClientRealTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  dueAt: string | null;
  completedAt: string | null;
}

/** Sección "Tareas del asesor" — solo lectura de las tareas REALES que el
 * asesor tiene cargadas en su propio módulo Tareas (workspace real, sin
 * owner_side/related_area: esos son conceptos de tu to-do interno, no
 * existen conceptualmente en su CRM). No hay acción de escritura a
 * propósito — es su workflow, no el tuyo. */
export async function getClientRealTasks(workspaceId: string, clientId: string): Promise<ClientRealTask[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, assigned_to, due_at, completed_at")
    .eq("workspace_id", linkedWorkspaceId)
    .order("due_at", { ascending: true, nullsFirst: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    status: r.status as string,
    priority: r.priority as string,
    assignedTo: r.assigned_to as string | null,
    dueAt: r.due_at as string | null,
    completedAt: r.completed_at as string | null,
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
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  const supabase = await createClient();
  const [{ data: bookings }, { data: tasks }, { data: policies }, { data: activity }] = await Promise.all([
    linkedWorkspaceId
      ? supabase.from("bookings").select("id, start_time, provider, contacts(name)").eq("workspace_id", linkedWorkspaceId)
      : Promise.resolve({ data: [] }),
    linkedWorkspaceId
      ? supabase.from("tasks").select("id, title, completed_at").eq("workspace_id", linkedWorkspaceId).eq("status", "completed").not("completed_at", "is", null)
      : Promise.resolve({ data: [] }),
    linkedWorkspaceId
      ? supabase.from("policies").select("id, product, company, issue_date").eq("workspace_id", linkedWorkspaceId).not("issue_date", "is", null)
      : Promise.resolve({ data: [] }),
    // audit_log es tuyo (renovación de contrato, cambios de estado que VOS
    // hiciste sobre la ficha) — se queda en tu workspace, no en el del asesor.
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

export interface ClientAudienceFunnel {
  contactos: number;
  conversaciones: number;
  interesados: number;
  citasGeneradas: number;
  show: number;
}

/** "Embudo de citas" de KPIs — cada escalón es un conteo real del workspace
 * del asesor, nunca inventado: Contactos = TODOS los leads reales de su CRM,
 * Conversaciones = conversations de esos contactos (su Inbox), Interesados =
 * bookings.resultado in ('interesado','calificado') (0127 — carga manual
 * tuya, arranca en 0 hasta que etiquetes citas reales desde Agenda), Citas
 * generadas = todas sus bookings, Show = bookings.attended = true. */
export async function getClientAudienceFunnel(workspaceId: string, clientId: string): Promise<ClientAudienceFunnel> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return { contactos: 0, conversaciones: 0, interesados: 0, citasGeneradas: 0, show: 0 };
  const supabase = await createClient();

  const [{ count: contactosCount }, { count: conversacionesCount }, { data: bookingRows }] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", linkedWorkspaceId),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("workspace_id", linkedWorkspaceId),
    supabase.from("bookings").select("attended, resultado").eq("workspace_id", linkedWorkspaceId),
  ]);

  const bookings = bookingRows ?? [];
  const interesados = bookings.filter((b) => b.resultado === "interesado" || b.resultado === "calificado").length;
  const show = bookings.filter((b) => b.attended === true).length;

  return {
    contactos: contactosCount ?? 0,
    conversaciones: conversacionesCount ?? 0,
    interesados,
    citasGeneradas: bookings.length,
    show,
  };
}

export interface ClientSetterPerformance {
  setterId: string;
  citas: number;
  showRate: number;
  polizas: number;
}

/** "Rendimiento por setter" / "Setters que más generan" de Operación/KPIs —
 * agrupa bookings.owner_id (quién generó/atendió la cita) y cruza pólizas
 * por policies.owner_id, ambos del workspace REAL del asesor — son sus
 * propios miembros de equipo, no los tuyos (resolver nombres con
 * getWorkspaceMembers(linkedWorkspaceId), no el workspaceId del caller). */
export async function getClientSetterPerformance(workspaceId: string, clientId: string): Promise<ClientSetterPerformance[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  const supabase = await createClient();
  const [{ data: bookingRows }, { data: policyRows }] = await Promise.all([
    supabase.from("bookings").select("owner_id, attended").eq("workspace_id", linkedWorkspaceId).not("owner_id", "is", null),
    supabase.from("policies").select("owner_id").eq("workspace_id", linkedWorkspaceId).not("owner_id", "is", null),
  ]);

  const bySetterCitas = new Map<string, { citas: number; shows: number }>();
  for (const b of bookingRows ?? []) {
    const setterId = b.owner_id as string;
    const entry = bySetterCitas.get(setterId) ?? { citas: 0, shows: 0 };
    entry.citas += 1;
    if (b.attended === true) entry.shows += 1;
    bySetterCitas.set(setterId, entry);
  }
  const polizasBySetter = new Map<string, number>();
  for (const p of policyRows ?? []) {
    const setterId = p.owner_id as string;
    polizasBySetter.set(setterId, (polizasBySetter.get(setterId) ?? 0) + 1);
  }

  return [...bySetterCitas.entries()]
    .map(([setterId, { citas, shows }]) => ({
      setterId,
      citas,
      showRate: citas > 0 ? Math.round((shows / citas) * 100) : 0,
      polizas: polizasBySetter.get(setterId) ?? 0,
    }))
    .sort((a, b) => b.citas - a.citas);
}

/** Fechas de conversaciones REALES del workspace del asesor — usado por la
 * fila "Conversaciones" de la "Comparativa mensual" de KPIs, que necesita
 * bucketear por mes (a diferencia de getClientConversationsCount, que solo
 * da un total). */
export async function getClientConversationDates(workspaceId: string, clientId: string): Promise<string[]> {
  const linkedWorkspaceId = await getLinkedWorkspaceId(workspaceId, clientId);
  if (!linkedWorkspaceId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select("created_at").eq("workspace_id", linkedWorkspaceId);
  return (data ?? []).map((r) => r.created_at as string);
}
