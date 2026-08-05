import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { POLICY_STAGES, POLICY_STATUS_BADGE_VARIANT, ACTIVE_LIKE_STATUSES, type PolicyStatus, type InsuranceType } from "@/lib/policies/constants";

// Re-exported for every existing server-side import site (actions.ts, etc.)
// — the real definitions live in constants.ts now so client components can
// import the values directly from a non-"server-only" module.
export { POLICY_STAGES, POLICY_STATUS_BADGE_VARIANT, ACTIVE_LIKE_STATUSES };
export type { PolicyStatus, InsuranceType };

export interface PolicyBeneficiary {
  name: string;
  relationship: string | null;
  percentage: number | null;
}

export interface PolicyListItem {
  id: string;
  pipelineItemId: string;
  stageId: string;
  position: number;
  policyNumber: string | null;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  company: string;
  product: string | null;
  insuranceType: InsuranceType;
  status: PolicyStatus;
  startDate: string | null;
  endDate: string | null;
  paymentFrequency: string | null;
  premium: number | null;
  premiumCurrency: string;
  commissionAmount: number | null;
  commissionStatus: string | null;
  ownerName: string | null;
}


/** Mismo patrón exacto que ensureCrmPipeline (src/lib/crm/actions.ts) /
 * ensurePipeline de Asesores: el pipeline de "Pólizas" se crea perezosamente
 * en el primer uso real (no hay flujo de "crear workspace" que lo siembre
 * hoy), con un re-chequeo bajo service-role para evitar una carrera entre
 * dos primeras visitas simultáneas. */
export async function ensurePolicyPipeline(workspaceId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "policies")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const service = createServiceRoleClient();

  const { data: existingRace } = await service
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "policies")
    .limit(1)
    .maybeSingle();
  if (existingRace) return existingRace.id as string;

  const { data: pipeline, error } = await service
    .from("pipelines")
    .insert({ workspace_id: workspaceId, module_key: "policies", name: "Pólizas" })
    .select("id")
    .single();
  if (error || !pipeline) throw new Error("No se pudo crear el pipeline de pólizas.");

  await service.from("pipeline_stages").insert(
    POLICY_STAGES.map((s, i) => ({ pipeline_id: pipeline.id, name: s.name, position: i })),
  );

  return pipeline.id as string;
}

export async function getPolicyStageOptions(workspaceId: string): Promise<{ id: string; name: string; position: number }[]> {
  const pipelineId = await ensurePolicyPipeline(workspaceId);
  const supabase = await createClient();
  const { data } = await supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipelineId).order("position", { ascending: true });
  return (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string, position: s.position as number }));
}

const LIST_SELECT =
  "id, policy_number, contact_id, company, product, insurance_type, status, pipeline_item_id, start_date, end_date, payment_frequency, premium, premium_currency, commission_amount, commission_status, owner_id, contacts(name, phone, email)";

export async function getPolicyList(workspaceId: string): Promise<PolicyListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("policies").select(LIST_SELECT).eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  const rows = data ?? [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = ownerIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>(
    (memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]),
  );

  const itemIds = rows.map((r) => r.pipeline_item_id).filter((id): id is string => Boolean(id));
  const { data: items } = itemIds.length
    ? await supabase.from("pipeline_items").select("id, stage_id, position").in("id", itemIds)
    : { data: [] as { id: string; stage_id: string; position: number }[] };
  const itemById = new Map((items ?? []).map((i) => [i.id as string, i]));

  // Una póliza sin pipeline_item_id no tiene dónde vivir en el Kanban — no
  // debería pasar en el flujo normal (create/confirm siempre crea el item),
  // pero se excluye defensivamente en vez de romper el tablero.
  return rows
    .filter((r) => r.pipeline_item_id && itemById.has(r.pipeline_item_id as string))
    .map((r) => {
      const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
      const item = itemById.get(r.pipeline_item_id as string)!;
      return {
        id: r.id as string,
        pipelineItemId: item.id as string,
        stageId: item.stage_id as string,
        position: item.position as number,
        policyNumber: r.policy_number as string | null,
        contactId: r.contact_id as string,
        contactName: (contact?.name as string | undefined) ?? "—",
        contactPhone: (contact?.phone as string | undefined) ?? null,
        contactEmail: (contact?.email as string | undefined) ?? null,
        company: r.company as string,
        product: r.product as string | null,
        insuranceType: r.insurance_type as InsuranceType,
        status: r.status as PolicyStatus,
        startDate: r.start_date as string | null,
        endDate: r.end_date as string | null,
        paymentFrequency: r.payment_frequency as string | null,
        premium: r.premium as number | null,
        premiumCurrency: r.premium_currency as string,
        commissionAmount: r.commission_amount as number | null,
        commissionStatus: r.commission_status as string | null,
        ownerName: r.owner_id ? (nameByMember.get(r.owner_id as string) ?? null) : null,
      };
    });
}

export interface PolicyDetail extends Omit<PolicyListItem, "stageId" | "pipelineItemId" | "position"> {
  workspaceId: string;
  stageId: string | null;
  pipelineItemId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactCompany: string | null;
  issueDate: string | null;
  startDate: string | null;
  paymentFrequency: string | null;
  sumInsured: number | null;
  deductible: string | null;
  beneficiaries: PolicyBeneficiary[];
  typeDetails: Record<string, unknown>;
  notes: string | null;
  source: string;
  pdfDocumentId: string | null;
  createdAt: string;
}

const DETAIL_SELECT =
  "id, policy_number, contact_id, company, product, insurance_type, status, pipeline_item_id, owner_id, issue_date, start_date, end_date, premium, premium_currency, payment_frequency, commission_amount, commission_status, sum_insured, deductible, beneficiaries, type_details, notes, source, pdf_document_id, created_at, contacts(name, email, phone, company)";

export async function getPolicyById(workspaceId: string, policyId: string): Promise<PolicyDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("policies").select(DETAIL_SELECT).eq("workspace_id", workspaceId).eq("id", policyId).maybeSingle();
  if (!data) return null;

  const contact = Array.isArray(data.contacts) ? data.contacts[0] : data.contacts;
  let stageId: string | null = null;
  let ownerName: string | null = null;
  const [{ data: item }, { data: memberNames }] = await Promise.all([
    data.pipeline_item_id
      ? supabase.from("pipeline_items").select("stage_id").eq("id", data.pipeline_item_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
    data.owner_id ? supabase.rpc("workspace_member_names", { ws_id: workspaceId }) : Promise.resolve({ data: null }),
  ]);
  stageId = (item?.stage_id as string | undefined) ?? null;
  ownerName = (memberNames as { member_id: string; full_name: string }[] | null)?.find((m) => m.member_id === data.owner_id)?.full_name ?? null;

  return {
    id: data.id as string,
    workspaceId,
    policyNumber: data.policy_number as string | null,
    contactId: data.contact_id as string,
    contactName: (contact?.name as string | undefined) ?? "—",
    contactEmail: (contact?.email as string | null) ?? null,
    contactPhone: (contact?.phone as string | null) ?? null,
    contactCompany: (contact?.company as string | null) ?? null,
    company: data.company as string,
    product: data.product as string | null,
    insuranceType: data.insurance_type as InsuranceType,
    status: data.status as PolicyStatus,
    stageId,
    issueDate: data.issue_date as string | null,
    startDate: data.start_date as string | null,
    endDate: data.end_date as string | null,
    premium: data.premium as number | null,
    premiumCurrency: data.premium_currency as string,
    paymentFrequency: data.payment_frequency as string | null,
    commissionAmount: data.commission_amount as number | null,
    commissionStatus: data.commission_status as string | null,
    sumInsured: data.sum_insured as number | null,
    deductible: data.deductible as string | null,
    beneficiaries: (data.beneficiaries as PolicyBeneficiary[] | null) ?? [],
    typeDetails: (data.type_details as Record<string, unknown> | null) ?? {},
    notes: data.notes as string | null,
    source: data.source as string,
    pdfDocumentId: data.pdf_document_id as string | null,
    pipelineItemId: data.pipeline_item_id as string | null,
    ownerName,
    createdAt: data.created_at as string,
  };
}

export interface PolicyCoverage {
  id: string;
  name: string;
  sumInsured: number | null;
  deductible: string | null;
  limitText: string | null;
  exclusions: string | null;
}

export async function getPolicyCoverages(policyId: string): Promise<PolicyCoverage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("policy_coverages").select("*").eq("policy_id", policyId).order("created_at", { ascending: true });
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    sumInsured: c.sum_insured as number | null,
    deductible: c.deductible as string | null,
    limitText: c.limit_text as string | null,
    exclusions: c.exclusions as string | null,
  }));
}

export interface PolicyDashboardKpis {
  totalPolicies: number;
  activeInsurers: number;
  totalActive: number;
  newThisMonth: number;
  renewalsUpcoming30: number;
  renewalsOverdue: number;
  commissionExpected: number;
  commissionCollected: number;
  commissionPending: number;
  portfolioValue: number;
  monthlyPremium: number;
  annualPremium: number;
  insuredClients: number;
  renewalRate: number | null;
  cancellations: number;
  byStatus: { status: PolicyStatus; count: number }[];
  byCompany: { company: string; count: number }[];
  byType: { type: InsuranceType; count: number }[];
}

/** Todos los números salen directo de policies — nada inventado. La "tasa de
 * renovación" es renovada / (renovada + vencida + cancelada) del período,
 * la única definición que se puede calcular sin un concepto de "elegible
 * para renovar" más elaborado (fuera de alcance de esta fase). */
export async function getPolicyDashboardKpis(workspaceId: string): Promise<PolicyDashboardKpis> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("policies")
    .select("id, contact_id, status, company, insurance_type, end_date, premium, payment_frequency, commission_amount, commission_status, created_at")
    .eq("workspace_id", workspaceId);
  const rows = (data ?? []) as {
    id: string;
    contact_id: string;
    status: PolicyStatus;
    company: string;
    insurance_type: InsuranceType;
    end_date: string | null;
    premium: number | null;
    payment_frequency: string | null;
    commission_amount: number | null;
    commission_status: string | null;
    created_at: string;
  }[];

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const active = rows.filter((r) => ACTIVE_LIKE_STATUSES.includes(r.status));
  const newThisMonth = rows.filter((r) => new Date(r.created_at) >= monthStart).length;
  const renewalsUpcoming30 = active.filter((r) => r.end_date && new Date(r.end_date) >= now && new Date(r.end_date) <= in30).length;
  const renewalsOverdue = rows.filter((r) => r.status === "vencida").length;

  const commissionExpected = rows.filter((r) => r.commission_status === "esperada").reduce((sum, r) => sum + (r.commission_amount ?? 0), 0);
  const commissionCollected = rows.filter((r) => r.commission_status === "cobrada").reduce((sum, r) => sum + (r.commission_amount ?? 0), 0);
  const commissionPending = rows.filter((r) => r.commission_status === "pendiente").reduce((sum, r) => sum + (r.commission_amount ?? 0), 0);

  const portfolioValue = active.reduce((sum, r) => sum + (r.premium ?? 0), 0);
  const monthlyEquivalent = (premium: number, freq: string | null) => {
    if (freq === "anual") return premium / 12;
    if (freq === "semestral") return premium / 6;
    if (freq === "trimestral") return premium / 3;
    return premium; // mensual/unico/desconocido: se cuenta tal cual
  };
  const monthlyPremium = active.reduce((sum, r) => sum + monthlyEquivalent(r.premium ?? 0, r.payment_frequency), 0);
  const annualPremium = monthlyPremium * 12;

  const insuredClients = new Set(active.map((r) => r.contact_id)).size;

  const renewed = rows.filter((r) => r.status === "renovada").length;
  const lapsedOrCancelled = rows.filter((r) => r.status === "vencida" || r.status === "cancelada").length;
  const renewalRate = renewed + lapsedOrCancelled > 0 ? renewed / (renewed + lapsedOrCancelled) : null;
  const cancellations = rows.filter((r) => r.status === "cancelada").length;

  const byStatusMap = new Map<PolicyStatus, number>();
  const byCompanyMap = new Map<string, number>();
  const byTypeMap = new Map<InsuranceType, number>();
  for (const r of rows) {
    byStatusMap.set(r.status, (byStatusMap.get(r.status) ?? 0) + 1);
    byCompanyMap.set(r.company, (byCompanyMap.get(r.company) ?? 0) + 1);
    byTypeMap.set(r.insurance_type, (byTypeMap.get(r.insurance_type) ?? 0) + 1);
  }

  return {
    totalPolicies: rows.length,
    activeInsurers: byCompanyMap.size,
    totalActive: active.length,
    newThisMonth,
    renewalsUpcoming30,
    renewalsOverdue,
    commissionExpected,
    commissionCollected,
    commissionPending,
    portfolioValue,
    monthlyPremium,
    annualPremium,
    insuredClients,
    renewalRate,
    cancellations,
    byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    byCompany: [...byCompanyMap.entries()].map(([company, count]) => ({ company, count })).sort((a, b) => b.count - a.count),
    byType: [...byTypeMap.entries()].map(([type, count]) => ({ type, count })),
  };
}

export interface ContactPolicySummary {
  id: string;
  policyNumber: string | null;
  company: string;
  product: string | null;
  insuranceType: InsuranceType;
  status: PolicyStatus;
  endDate: string | null;
  premium: number | null;
  premiumCurrency: string;
}

/** Pólizas de un contacto (activas/vencidas/renovadas/canceladas) — para el
 * panel de Contactos ("cada cliente debe mostrar automáticamente todas sus
 * pólizas"). Shape más liviano que PolicyListItem: no hace falta nada del
 * Kanban (pipelineItemId/stageId/position) para esta lista de solo lectura. */
export async function getPoliciesForContact(workspaceId: string, contactId: string): Promise<ContactPolicySummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("policies")
    .select("id, policy_number, company, product, insurance_type, status, end_date, premium, premium_currency")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  return rows.map((r) => ({
    id: r.id as string,
    policyNumber: r.policy_number as string | null,
    company: r.company as string,
    product: r.product as string | null,
    insuranceType: r.insurance_type as InsuranceType,
    status: r.status as PolicyStatus,
    endDate: r.end_date as string | null,
    premium: r.premium as number | null,
    premiumCurrency: r.premium_currency as string,
  }));
}

export interface PolicyActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const POLICY_ACTION_LABEL: Record<string, string> = {
  policy_created: "Póliza creada",
  policy_created_from_pdf: "Póliza creada desde PDF (IA)",
  policy_stage_changed: "Cambió de etapa",
  policy_renewal_automation_fired: "Automatización de renovación disparada",
};

/** Mismo patrón que getOpportunityActivity (src/lib/crm/queries.ts) — lee de
 * audit_log filtrado por entity_type='policy'. */
export async function getPolicyActivity(workspaceId: string, policyId: string): Promise<PolicyActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", "policy")
    .eq("entity_id", policyId)
    .order("created_at", { ascending: false });

  const actorIds = Array.from(new Set((data ?? []).map((r) => r.actor_id as string | null).filter((id): id is string => Boolean(id))));
  const { data: names } = actorIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map(((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]));

  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: POLICY_ACTION_LABEL[r.action as string] ?? (r.action as string),
    actorName: r.actor_id ? (nameByMember.get(r.actor_id as string) ?? null) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}
