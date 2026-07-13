import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AdvisorStage {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface DealCard {
  id: string;
  pipelineItemId: string;
  stageId: string;
  position: number;
  title: string;
  value: number;
  currency: string;
  contactId: string;
  contactName: string;
  contactAvatarUrl: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  ownerId: string | null;
  ownerName: string | null;
  policyType: string | null;
  renewalDate: string | null;
  commission: number | null;
  createdAt: string;
  lastNote: { body: string; createdAt: string } | null;
}

export interface AdvisorsKpis {
  totalPolicies: number;
  newThisMonth: number;
  totalCommissionThisMonth: number;
  totalPortfolioValue: number;
}

export interface AdvisorsBoard {
  pipelineId: string;
  stages: AdvisorStage[];
  cardsByStage: Record<string, DealCard[]>;
  kpis: AdvisorsKpis;
}

function monthBounds() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

/** "Asesores" module board — same pipeline/opportunities/contacts core engine
 * as the CRM board (src/lib/crm/queries.ts's getCrmBoard), filtered to this
 * module's own pipeline (`module_key='advisors'`), with policy-specific data
 * merged in from `advisor_policies` (1:1 extension of `opportunities`, same
 * pattern as `candidates` extending `contacts` in ATS). Deliberately simpler
 * than the CRM board (no priority/probability/tags/tasks/bookings enrichment)
 * — first pass, scoped down explicitly with the user; can grow later. */
export async function getAdvisorsBoard(workspaceId: string): Promise<AdvisorsBoard | null> {
  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "advisors")
    .limit(1)
    .maybeSingle();

  if (!pipeline) return null;

  const [{ data: stages }, { data: items }] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, position, is_won, is_lost")
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true }),
    supabase
      .from("pipeline_items")
      .select("id, stage_id, position, item_id")
      .eq("pipeline_id", pipeline.id)
      .eq("item_type", "opportunity")
      .order("position", { ascending: true }),
  ]);

  const opportunityIds = (items ?? []).map((i) => i.item_id as string);

  const { data: opportunities } = opportunityIds.length
    ? await supabase
        .from("opportunities")
        .select("id, title, value, currency, owner_id, created_at, contacts(id, name, company, avatar_url, email, phone)")
        .in("id", opportunityIds)
    : { data: [] };

  const ownerIds = Array.from(
    new Set((opportunities ?? []).map((o) => o.owner_id as string | null).filter((id): id is string => Boolean(id))),
  );

  const [{ data: policies }, { data: names }, { data: notes }] = await Promise.all([
    opportunityIds.length
      ? supabase
          .from("advisor_policies")
          .select("opportunity_id, policy_type, renewal_date, commission")
          .in("opportunity_id", opportunityIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length ? supabase.rpc("workspace_member_names", { ws_id: workspaceId }) : Promise.resolve({ data: [] }),
    opportunityIds.length
      ? supabase
          .from("notes")
          .select("notable_id, body, created_at")
          .eq("workspace_id", workspaceId)
          .eq("notable_type", "opportunity")
          .in("notable_id", opportunityIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const policyByOpportunity = new Map(
    (policies ?? []).map((p) => [
      p.opportunity_id as string,
      {
        policyType: p.policy_type as string | null,
        renewalDate: p.renewal_date as string | null,
        commission: p.commission === null || p.commission === undefined ? null : Number(p.commission),
      },
    ]),
  );
  const nameByOwnerId = new Map(
    ((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]),
  );
  const lastNoteByOpportunity = new Map<string, { body: string; createdAt: string }>();
  for (const n of notes ?? []) {
    const oppId = n.notable_id as string;
    if (!lastNoteByOpportunity.has(oppId)) {
      lastNoteByOpportunity.set(oppId, { body: n.body as string, createdAt: n.created_at as string });
    }
  }

  const opportunityById = new Map((opportunities ?? []).map((o) => [o.id as string, o]));

  const cardsByStage: Record<string, DealCard[]> = {};
  for (const stage of stages ?? []) cardsByStage[stage.id as string] = [];

  for (const item of items ?? []) {
    const opp = opportunityById.get(item.item_id as string);
    if (!opp) continue;
    const contact = Array.isArray(opp.contacts) ? opp.contacts[0] : opp.contacts;
    const stageId = item.stage_id as string;
    const policy = policyByOpportunity.get(opp.id as string) ?? { policyType: null, renewalDate: null, commission: null };

    const card: DealCard = {
      id: opp.id as string,
      pipelineItemId: item.id as string,
      stageId,
      position: item.position as number,
      title: opp.title as string,
      value: Number(opp.value ?? 0),
      currency: opp.currency as string,
      contactId: (contact?.id as string) ?? "",
      contactName: contact?.name ?? "Sin nombre",
      contactAvatarUrl: contact?.avatar_url ?? null,
      company: contact?.company ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      ownerId: (opp.owner_id as string | null) ?? null,
      ownerName: opp.owner_id ? (nameByOwnerId.get(opp.owner_id as string) ?? null) : null,
      policyType: policy.policyType,
      renewalDate: policy.renewalDate,
      commission: policy.commission,
      createdAt: opp.created_at as string,
      lastNote: lastNoteByOpportunity.get(opp.id as string) ?? null,
    };
    if (!cardsByStage[stageId]) cardsByStage[stageId] = [];
    cardsByStage[stageId].push(card);
  }

  const stageList: AdvisorStage[] = (stages ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    position: s.position as number,
    isWon: s.is_won as boolean,
    isLost: s.is_lost as boolean,
  }));

  const { start, end } = monthBounds();
  const inThisMonth = (iso: string) => {
    const t = new Date(iso);
    return t >= start && t < end;
  };

  const totalPolicies = (opportunities ?? []).length;
  const newThisMonth = (opportunities ?? []).filter((o) => inThisMonth(o.created_at as string)).length;
  const totalCommissionThisMonth = (opportunities ?? [])
    .filter((o) => inThisMonth(o.created_at as string))
    .reduce((sum, o) => sum + (policyByOpportunity.get(o.id as string)?.commission ?? 0), 0);
  const totalPortfolioValue = stageList
    .filter((s) => !s.isWon && !s.isLost)
    .reduce((sum, s) => sum + (cardsByStage[s.id] ?? []).reduce((inner, c) => inner + c.value, 0), 0);

  return {
    pipelineId: pipeline.id as string,
    stages: stageList,
    cardsByStage,
    kpis: { totalPolicies, newThisMonth, totalCommissionThisMonth, totalPortfolioValue },
  };
}

export interface DealDetail {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  policyType: string | null;
  renewalDate: string | null;
  commission: number | null;
  contact: { id: string; name: string; company: string | null; email: string | null; phone: string | null };
  createdAt: string;
  notes: { id: string; body: string; createdAt: string }[];
}

export async function getDealDetail(workspaceId: string, opportunityId: string): Promise<DealDetail | null> {
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, title, value, currency, status, created_at, contacts(id, name, company, email, phone)")
    .eq("workspace_id", workspaceId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (!opp) return null;

  const contact = Array.isArray(opp.contacts) ? opp.contacts[0] : opp.contacts;

  const [{ data: policy }, { data: notes }] = await Promise.all([
    supabase
      .from("advisor_policies")
      .select("policy_type, renewal_date, commission")
      .eq("opportunity_id", opportunityId)
      .maybeSingle(),
    supabase
      .from("notes")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .eq("notable_type", "opportunity")
      .eq("notable_id", opportunityId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    id: opp.id as string,
    title: opp.title as string,
    value: Number(opp.value ?? 0),
    currency: opp.currency as string,
    status: opp.status as string,
    policyType: (policy?.policy_type as string | null) ?? null,
    renewalDate: (policy?.renewal_date as string | null) ?? null,
    commission: policy?.commission === null || policy?.commission === undefined ? null : Number(policy.commission),
    contact: {
      id: contact?.id ?? "",
      name: contact?.name ?? "Sin nombre",
      company: contact?.company ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    },
    createdAt: opp.created_at as string,
    notes: (notes ?? []).map((n) => ({ id: n.id as string, body: n.body as string, createdAt: n.created_at as string })),
  };
}
