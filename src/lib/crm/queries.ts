import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface OpportunityCard {
  id: string;
  pipelineItemId: string;
  stageId: string;
  position: number;
  title: string;
  value: number;
  currency: string;
  contactName: string;
  company: string | null;
  ownerName: string | null;
  createdAt: string;
  nextActivity: { title: string; dueAt: string | null } | null;
}

export interface CrmBoard {
  pipelineId: string;
  stages: PipelineStage[];
  cardsByStage: Record<string, OpportunityCard[]>;
}

/** The workspace's single sales pipeline (module_key='crm') — created by the seed today;
 * a future "manage pipelines" screen would let a workspace have more than one. */
export async function getCrmBoard(workspaceId: string): Promise<CrmBoard | null> {
  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "crm")
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
        .select("id, title, value, currency, created_at, contacts(name, company), workspace_members(user_id)")
        .in("id", opportunityIds)
    : { data: [] };

  const { data: tasks } = opportunityIds.length
    ? await supabase
        .from("tasks")
        .select("title, due_at, related_id")
        .in("related_id", opportunityIds)
        .eq("related_type", "opportunity")
        .is("completed_at", null)
        .order("due_at", { ascending: true })
    : { data: [] };

  const nextActivityByOpportunity = new Map<string, { title: string; dueAt: string | null }>();
  for (const t of tasks ?? []) {
    const key = t.related_id as string;
    if (!nextActivityByOpportunity.has(key)) {
      nextActivityByOpportunity.set(key, { title: t.title as string, dueAt: t.due_at as string | null });
    }
  }

  const opportunityById = new Map((opportunities ?? []).map((o) => [o.id as string, o]));

  const cardsByStage: Record<string, OpportunityCard[]> = {};
  for (const stage of stages ?? []) {
    cardsByStage[stage.id as string] = [];
  }

  for (const item of items ?? []) {
    const opp = opportunityById.get(item.item_id as string);
    if (!opp) continue;
    const contact = Array.isArray(opp.contacts) ? opp.contacts[0] : opp.contacts;
    const stageId = item.stage_id as string;
    const card: OpportunityCard = {
      id: opp.id as string,
      pipelineItemId: item.id as string,
      stageId,
      position: item.position as number,
      title: opp.title as string,
      value: Number(opp.value ?? 0),
      currency: opp.currency as string,
      contactName: contact?.name ?? "Sin nombre",
      company: contact?.company ?? null,
      ownerName: null,
      createdAt: opp.created_at as string,
      nextActivity: nextActivityByOpportunity.get(opp.id as string) ?? null,
    };
    if (!cardsByStage[stageId]) cardsByStage[stageId] = [];
    cardsByStage[stageId].push(card);
  }

  return {
    pipelineId: pipeline.id as string,
    stages: (stages ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      position: s.position as number,
      isWon: s.is_won as boolean,
      isLost: s.is_lost as boolean,
    })),
    cardsByStage,
  };
}

export interface OpportunityDetail {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  contact: {
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  createdAt: string;
  notes: { id: string; body: string; createdAt: string }[];
}

export async function getOpportunityDetail(
  workspaceId: string,
  opportunityId: string,
): Promise<OpportunityDetail | null> {
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, title, value, currency, status, created_at, contacts(name, company, email, phone)")
    .eq("workspace_id", workspaceId)
    .eq("id", opportunityId)
    .maybeSingle();

  if (!opp) return null;

  const { data: notes } = await supabase
    .from("notes")
    .select("id, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("notable_type", "opportunity")
    .eq("notable_id", opportunityId)
    .order("created_at", { ascending: false });

  const contact = Array.isArray(opp.contacts) ? opp.contacts[0] : opp.contacts;

  return {
    id: opp.id as string,
    title: opp.title as string,
    value: Number(opp.value ?? 0),
    currency: opp.currency as string,
    status: opp.status as string,
    contact: {
      name: contact?.name ?? "Sin nombre",
      company: contact?.company ?? null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    },
    createdAt: opp.created_at as string,
    notes: (notes ?? []).map((n) => ({
      id: n.id as string,
      body: n.body as string,
      createdAt: n.created_at as string,
    })),
  };
}
