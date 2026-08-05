import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPolicyDashboardKpis } from "@/lib/policies/queries";
import type { CollectionStatus } from "@/lib/collections/constants";

export { type CollectionStatus };

export interface CollectionItem {
  id: string;
  policyId: string;
  contactId: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  company: string;
  policyNumber: string | null;
  product: string | null;
  dueDate: string;
  issueDate: string | null;
  amount: number;
  currency: string;
  status: CollectionStatus;
  paidAt: string | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  reference: string | null;
  notes: string | null;
  ownerId: string | null;
  ownerName: string | null;
}

interface PolicyRow {
  id: string;
  company: string;
  policy_number: string | null;
  product: string | null;
  contact_id: string | null;
  owner_id: string | null;
  contacts: { name: string; phone: string | null; email: string | null } | { name: string; phone: string | null; email: string | null }[] | null;
}

function mapContact(policy: PolicyRow | undefined) {
  if (!policy) return null;
  return Array.isArray(policy.contacts) ? policy.contacts[0] : policy.contacts;
}

/** Todo Cobranza lee de policy_payments (0097) + policies — nunca una tabla
 * paralela. Se resuelve en dos pasos (policies del workspace, después sus
 * pagos) en vez de un embed anidado de Supabase, más simple de verificar
 * que el filtro `.eq("policies.workspace_id", ...)` sobre un join. */
export async function getCollectionsList(workspaceId: string): Promise<CollectionItem[]> {
  const supabase = await createClient();
  const { data: policyRows } = await supabase
    .from("policies")
    .select("id, company, policy_number, product, contact_id, owner_id, contacts(name, phone, email)")
    .eq("workspace_id", workspaceId);
  const policies = (policyRows ?? []) as unknown as PolicyRow[];
  const policyById = new Map(policies.map((p) => [p.id, p]));
  const policyIds = [...policyById.keys()];
  if (policyIds.length === 0) return [];

  const { data: payments } = await supabase.from("policy_payments").select("*").in("policy_id", policyIds).order("due_date", { ascending: true });
  const rows = payments ?? [];

  const ownerIds = [...new Set(policies.map((p) => p.owner_id).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = ownerIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>((memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]));

  return rows.map((r) => {
    const policy = policyById.get(r.policy_id as string);
    const contact = mapContact(policy);
    return {
      id: r.id as string,
      policyId: r.policy_id as string,
      contactId: policy?.contact_id ?? null,
      contactName: contact?.name ?? "—",
      contactPhone: contact?.phone ?? null,
      contactEmail: contact?.email ?? null,
      company: policy?.company ?? "—",
      policyNumber: policy?.policy_number ?? null,
      product: policy?.product ?? null,
      dueDate: r.due_date as string,
      issueDate: r.issue_date as string | null,
      amount: r.amount as number,
      currency: r.currency as string,
      status: r.status as CollectionStatus,
      paidAt: r.paid_at as string | null,
      paymentMethod: r.payment_method as string | null,
      receiptNumber: r.receipt_number as string | null,
      reference: r.reference as string | null,
      notes: r.notes as string | null,
      ownerId: policy?.owner_id ?? null,
      ownerName: policy?.owner_id ? (nameByMember.get(policy.owner_id) ?? null) : null,
    };
  });
}

export async function getCollectionById(workspaceId: string, paymentId: string): Promise<CollectionItem | null> {
  const supabase = await createClient();
  const { data: payment } = await supabase.from("policy_payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return null;

  const { data: policy } = await supabase
    .from("policies")
    .select("id, company, policy_number, product, contact_id, owner_id, contacts(name, phone, email)")
    .eq("id", payment.policy_id as string)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!policy) return null;

  let ownerName: string | null = null;
  if (policy.owner_id) {
    const { data: memberNames } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
    ownerName = ((memberNames ?? []) as { member_id: string; full_name: string }[]).find((m) => m.member_id === policy.owner_id)?.full_name ?? null;
  }
  const contact = mapContact(policy as unknown as PolicyRow);

  return {
    id: payment.id as string,
    policyId: payment.policy_id as string,
    contactId: (policy.contact_id as string | null) ?? null,
    contactName: contact?.name ?? "—",
    contactPhone: contact?.phone ?? null,
    contactEmail: contact?.email ?? null,
    company: policy.company as string,
    policyNumber: policy.policy_number as string | null,
    product: policy.product as string | null,
    dueDate: payment.due_date as string,
    issueDate: payment.issue_date as string | null,
    amount: payment.amount as number,
    currency: payment.currency as string,
    status: payment.status as CollectionStatus,
    paidAt: payment.paid_at as string | null,
    paymentMethod: payment.payment_method as string | null,
    receiptNumber: payment.receipt_number as string | null,
    reference: payment.reference as string | null,
    notes: payment.notes as string | null,
    ownerId: (policy.owner_id as string | null) ?? null,
    ownerName,
  };
}

export interface CollectionsKpis {
  totalPending: number;
  collectedThisMonth: number;
  overdueAmount: number;
  overdueCount: number;
  upcoming7Count: number;
  upcoming7Amount: number;
  monthlyPremium: number;
  annualPremium: number;
  effectiveCollectionRatePct: number;
  commissionGenerated: number;
}

/** "Prima mensual/anual" y "Comisión generada" reusan exactamente los
 * números ya calculados por getPolicyDashboardKpis (Pólizas) — nada
 * recalculado dos veces, mismo criterio "no duplicar información" pedido
 * para todo el módulo. */
export async function getCollectionsKpis(workspaceId: string): Promise<CollectionsKpis> {
  const supabase = await createClient();
  const { data: policyIdRows } = await supabase.from("policies").select("id").eq("workspace_id", workspaceId);
  const ids = (policyIdRows ?? []).map((p) => p.id as string);

  const [{ data: payments }, policyKpis] = await Promise.all([
    ids.length
      ? supabase.from("policy_payments").select("amount, status, due_date, paid_at").in("policy_id", ids)
      : Promise.resolve({ data: [] as { amount: number; status: string; due_date: string; paid_at: string | null }[] }),
    getPolicyDashboardKpis(workspaceId),
  ]);
  const rows = (payments ?? []) as { amount: number; status: string; due_date: string; paid_at: string | null }[];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in7 = new Date(now.getTime() + 7 * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const openRows = rows.filter((r) => r.status === "pendiente" || r.status === "en_seguimiento");
  const totalPending = openRows.reduce((s, r) => s + r.amount, 0);
  const collectedThisMonth = rows.filter((r) => r.status === "pagado" && r.paid_at && new Date(r.paid_at) >= monthStart).reduce((s, r) => s + r.amount, 0);

  const overdueRows = openRows.filter((r) => new Date(r.due_date) < now);
  const overdueAmount = overdueRows.reduce((s, r) => s + r.amount, 0);
  const overdueCount = overdueRows.length;

  const upcomingRows = openRows.filter((r) => new Date(r.due_date) >= now && new Date(r.due_date) <= in7);
  const upcoming7Count = upcomingRows.length;
  const upcoming7Amount = upcomingRows.reduce((s, r) => s + r.amount, 0);

  const paidCount = rows.filter((r) => r.status === "pagado").length;
  const overdueEverCount = rows.filter((r) => r.status !== "cancelado" && r.status !== "pagado" && new Date(r.due_date) < now).length;
  const denom = paidCount + overdueEverCount;
  const effectiveCollectionRatePct = denom > 0 ? Math.round((paidCount / denom) * 100) : 0;

  return {
    totalPending,
    collectedThisMonth,
    overdueAmount,
    overdueCount,
    upcoming7Count,
    upcoming7Amount,
    monthlyPremium: policyKpis.monthlyPremium,
    annualPremium: policyKpis.annualPremium,
    effectiveCollectionRatePct,
    commissionGenerated: policyKpis.commissionCollected,
  };
}

export interface CollectionActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const COLLECTION_ACTION_LABEL: Record<string, string> = {
  collection_payment_registered: "Pago registrado",
  collection_reminder_automation_fired: "Recordatorio de cobro disparado",
};

/** Mismo patrón que getPolicyActivity — lee de audit_log filtrado por
 * entity_type='policy' (logActivity para cobros usa el policy_id como
 * entity_id, ver collections/actions.ts) y por metadata.paymentId, para
 * mostrar solo el historial de este cobro puntual y no el de toda la
 * póliza. */
export async function getCollectionActivity(workspaceId: string, paymentId: string): Promise<CollectionActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", "policy")
    .eq("metadata->>paymentId", paymentId)
    .order("created_at", { ascending: false });

  const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_id as string | null).filter((id): id is string => Boolean(id))));
  const { data: names } = actorIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map(((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]));

  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: COLLECTION_ACTION_LABEL[r.action as string] ?? (r.action as string),
    actorName: r.actor_id ? (nameByMember.get(r.actor_id as string) ?? null) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}
