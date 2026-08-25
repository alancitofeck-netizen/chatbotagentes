import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getRealAdvisorWorkspaces } from "@/lib/clients/queries";
import { ACTIVE_LIKE_STATUSES, type PolicyStatus } from "@/lib/policies/constants";
import type { CollectionStatus } from "@/lib/collections/constants";

/** Capa de datos "Asesores → Operaciones" — agrega policies/policy_payments/
 * documents/audit_log CROSS todos los asesores reales de la agencia, mismo
 * patrón ya resuelto por agencyPerformance.ts/getAgendaPerformance: service-
 * role + .in("workspace_id", linkedWorkspaceIds), porque policies/pagos/
 * documentos viven en el workspace REAL de cada asesor, no en el de la
 * agencia. Las "tareas operativas" son la única excepción (tasks.client_id
 * vive en el propio workspace de la agencia, mismo criterio que
 * getClientTasks) — esas se leen con el cliente de sesión normal. Nada acá
 * escribe: es una vista agregada de solo lectura sobre tablas ya existentes,
 * ninguna tabla/columna nueva. */

export interface AgencyPolicyRow {
  id: string;
  advisorWorkspaceId: string;
  advisorName: string;
  contactId: string;
  contactName: string | null;
  policyNumber: string | null;
  product: string;
  company: string;
  insuranceType: string;
  status: PolicyStatus;
  premium: number | null;
  premiumCurrency: string | null;
  paymentFrequency: string | null;
  commissionAmount: number | null;
  commissionStatus: string | null;
  issueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  source: string;
  createdAt: string;
}

/** Todas las pólizas de todos los asesores reales — base de "Pólizas
 * recientes", KPIs, funnel, evolución y top productos (un solo fetch, el
 * resto se deriva en memoria, mismo criterio que getAgencyKpiEntries). */
export async function getAgencyPolicies(): Promise<AgencyPolicyRow[]> {
  const advisors = await getRealAdvisorWorkspaces();
  if (advisors.length === 0) return [];
  const nameByWorkspace = new Map(advisors.map((a) => [a.workspaceId, a.name]));
  const linkedWorkspaceIds = advisors.map((a) => a.workspaceId);

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("policies")
    .select(
      "id, workspace_id, contact_id, policy_number, product, company, insurance_type, status, premium, premium_currency, payment_frequency, commission_amount, commission_status, issue_date, start_date, end_date, renewal_date, source, created_at, contacts(name)",
    )
    .in("workspace_id", linkedWorkspaceIds)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      advisorWorkspaceId: r.workspace_id as string,
      advisorName: nameByWorkspace.get(r.workspace_id as string) ?? "—",
      contactId: r.contact_id as string,
      contactName: (contact?.name as string | undefined) ?? null,
      policyNumber: r.policy_number as string | null,
      product: r.product as string,
      company: r.company as string,
      insuranceType: r.insurance_type as string,
      status: r.status as PolicyStatus,
      premium: r.premium as number | null,
      premiumCurrency: r.premium_currency as string | null,
      paymentFrequency: r.payment_frequency as string | null,
      commissionAmount: r.commission_amount as number | null,
      commissionStatus: r.commission_status as string | null,
      issueDate: r.issue_date as string | null,
      startDate: r.start_date as string | null,
      endDate: r.end_date as string | null,
      renewalDate: r.renewal_date as string | null,
      source: r.source as string,
      createdAt: r.created_at as string,
    };
  });
}

export interface AgencyPolicyPaymentRow {
  id: string;
  policyId: string;
  policyProduct: string;
  policyNumber: string | null;
  advisorWorkspaceId: string;
  advisorName: string;
  contactName: string | null;
  dueDate: string;
  amount: number;
  currency: string;
  status: CollectionStatus;
}

/** "Pagos y comisiones" — cuotas de policy_payments (0097/0100) de todas las
 * pólizas cross-asesor. `policies` ya trae la lista de IDs a filtrar, así
 * evitamos volver a resolver los workspaces de asesores acá adentro. */
export async function getAgencyPolicyPayments(policies: AgencyPolicyRow[]): Promise<AgencyPolicyPaymentRow[]> {
  if (policies.length === 0) return [];
  const policyMeta = new Map(policies.map((p) => [p.id, p]));
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("policy_payments")
    .select("id, policy_id, due_date, amount, currency, status")
    .in("policy_id", policies.map((p) => p.id))
    .order("due_date", { ascending: true });

  return (data ?? [])
    .map((r) => {
      const meta = policyMeta.get(r.policy_id as string);
      if (!meta) return null;
      return {
        id: r.id as string,
        policyId: r.policy_id as string,
        policyProduct: meta.product,
        policyNumber: meta.policyNumber,
        advisorWorkspaceId: meta.advisorWorkspaceId,
        advisorName: meta.advisorName,
        contactName: meta.contactName,
        dueDate: r.due_date as string,
        amount: r.amount as number,
        currency: r.currency as string,
        status: r.status as CollectionStatus,
      };
    })
    .filter((r): r is AgencyPolicyPaymentRow => r !== null);
}

export interface AgencyOperationalTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  ownerSide: "client" | "growth_link" | null;
  assignedTo: string | null;
  dueAt: string | null;
  completedAt: string | null;
  relatedArea: string | null;
  advisorWorkspaceId: string | null;
  advisorName: string;
  createdAt: string;
}

/** "Tareas operativas" — el to-do interno de la agencia sobre cada asesor
 * (tasks.client_id → clients, mismo dato que ya lee getClientTasks por un
 * solo cliente), generalizado a TODOS los clientes de la agencia. Vive en
 * el workspace de la agencia (no en el del asesor), así que usa el cliente
 * de sesión normal — no hace falta service-role acá. */
export async function getAgencyOperationalTasks(agencyWorkspaceId: string): Promise<AgencyOperationalTask[]> {
  const supabase = await createClient();
  const [{ data: clientRows }, advisors] = await Promise.all([
    supabase.from("clients").select("id, linked_workspace_id").eq("workspace_id", agencyWorkspaceId),
    getRealAdvisorWorkspaces(),
  ]);
  const nameByWorkspace = new Map(advisors.map((a) => [a.workspaceId, a.name]));
  const clientMeta = new Map((clientRows ?? []).map((c) => [c.id as string, { advisorWorkspaceId: c.linked_workspace_id as string | null, advisorName: nameByWorkspace.get(c.linked_workspace_id as string) ?? "—" }]));
  const clientIds = [...clientMeta.keys()];
  if (clientIds.length === 0) return [];

  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, owner_side, assigned_to, due_at, completed_at, related_area, client_id, created_at")
    .eq("workspace_id", agencyWorkspaceId)
    .in("client_id", clientIds)
    .order("due_at", { ascending: true, nullsFirst: false });

  return (data ?? []).map((r) => {
    const meta = clientMeta.get(r.client_id as string);
    return {
      id: r.id as string,
      title: r.title as string,
      status: r.status as string,
      priority: r.priority as string,
      ownerSide: r.owner_side as "client" | "growth_link" | null,
      assignedTo: r.assigned_to as string | null,
      dueAt: r.due_at as string | null,
      completedAt: r.completed_at as string | null,
      relatedArea: r.related_area as string | null,
      advisorWorkspaceId: meta?.advisorWorkspaceId ?? null,
      advisorName: meta?.advisorName ?? "—",
      createdAt: r.created_at as string,
    };
  });
}

export interface AgencyPendingDocPolicy {
  policyId: string;
  advisorWorkspaceId: string;
  advisorName: string;
  contactName: string | null;
  product: string;
  company: string;
  status: PolicyStatus;
  createdAt: string;
}

const DOC_PENDING_STATUSES: PolicyStatus[] = ["cotizacion", "documentacion", "pendiente_emision"];

/** "Documentación pendiente" — no existe ningún checklist nativo (ver
 * investigación previa), así que se deriva: pólizas en una etapa temprana
 * (todavía sin emitir) que no tienen NINGÚN documents.related_type='policy'
 * cargado — mismo vínculo que ya usa el tab Documentos del detalle de
 * póliza (src/lib/policies/actions.ts). */
export async function getAgencyPendingDocumentation(policies: AgencyPolicyRow[]): Promise<AgencyPendingDocPolicy[]> {
  const candidates = policies.filter((p) => DOC_PENDING_STATUSES.includes(p.status));
  if (candidates.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("documents")
    .select("related_id")
    .eq("related_type", "policy")
    .eq("is_trashed", false)
    .in("related_id", candidates.map((p) => p.id));
  const hasDocs = new Set((data ?? []).map((d) => d.related_id as string));

  return candidates
    .filter((p) => !hasDocs.has(p.id))
    .map((p) => ({ policyId: p.id, advisorWorkspaceId: p.advisorWorkspaceId, advisorName: p.advisorName, contactName: p.contactName, product: p.product, company: p.company, status: p.status, createdAt: p.createdAt }));
}

export interface AgencyActivityEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  advisorWorkspaceId: string;
  advisorName: string;
  createdAt: string;
}

/** "Actividad reciente" — audit_log ya tiene volumen real para
 * entity_type='policy'/'insurance_connection' (327 filas confirmadas en
 * vivo, no una tabla vacía), así que se reusa tal cual en vez de derivar de
 * timestamps sueltos. */
export async function getAgencyRecentActivity(limit = 20): Promise<AgencyActivityEvent[]> {
  const advisors = await getRealAdvisorWorkspaces();
  if (advisors.length === 0) return [];
  const nameByWorkspace = new Map(advisors.map((a) => [a.workspaceId, a.name]));
  const linkedWorkspaceIds = advisors.map((a) => a.workspaceId);

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, workspace_id, created_at")
    .in("workspace_id", linkedWorkspaceIds)
    .in("entity_type", ["policy", "insurance_connection"])
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: r.action as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string,
    advisorWorkspaceId: r.workspace_id as string,
    advisorName: nameByWorkspace.get(r.workspace_id as string) ?? "—",
    createdAt: r.created_at as string,
  }));
}

// Derivaciones puras (funnel/top productos/anualización) viven en
// agencyOperationsDerive.ts, sin "server-only" — ver el comentario de ese
// archivo (un import de valor desde este módulo rompería cualquier Client
// Component que lo use, aunque la función importada sea pura).

export { ACTIVE_LIKE_STATUSES };
