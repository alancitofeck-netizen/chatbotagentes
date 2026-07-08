import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface VacancySummary {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  status: string;
  candidateCount: number;
  createdAt: string;
}

export async function getVacancies(workspaceId: string): Promise<VacancySummary[]> {
  const supabase = await createClient();

  const { data: vacancies } = await supabase
    .from("vacancies")
    .select("id, title, department, location, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (!vacancies?.length) return [];

  const { data: applications } = await supabase
    .from("candidate_applications")
    .select("vacancy_id")
    .in(
      "vacancy_id",
      vacancies.map((v) => v.id as string),
    );

  const countByVacancy = new Map<string, number>();
  for (const a of applications ?? []) {
    const key = a.vacancy_id as string;
    countByVacancy.set(key, (countByVacancy.get(key) ?? 0) + 1);
  }

  return vacancies.map((v) => ({
    id: v.id as string,
    title: v.title as string,
    department: v.department as string | null,
    location: v.location as string | null,
    status: v.status as string,
    candidateCount: countByVacancy.get(v.id as string) ?? 0,
    createdAt: v.created_at as string,
  }));
}

export interface CandidateCard {
  id: string; // candidate_applications.id
  pipelineItemId: string;
  stageId: string;
  position: number;
  candidateId: string;
  contactName: string;
  contactAvatarUrl: string | null;
  source: string | null;
  appliedAt: string;
  nextActivity: { title: string; dueAt: string | null } | null;
}

export interface VacancyStage {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface VacancyBoard {
  vacancy: { id: string; title: string; department: string | null; location: string | null; status: string };
  pipelineId: string;
  stages: VacancyStage[];
  cardsByStage: Record<string, CandidateCard[]>;
}

export async function getVacancyBoard(workspaceId: string, vacancyId: string): Promise<VacancyBoard | null> {
  const supabase = await createClient();

  const { data: vacancy } = await supabase
    .from("vacancies")
    .select("id, title, department, location, status, pipeline_id")
    .eq("workspace_id", workspaceId)
    .eq("id", vacancyId)
    .maybeSingle();

  if (!vacancy || !vacancy.pipeline_id) return null;

  const [{ data: stages }, { data: items }] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, position, is_won, is_lost")
      .eq("pipeline_id", vacancy.pipeline_id)
      .order("position", { ascending: true }),
    supabase
      .from("pipeline_items")
      .select("id, stage_id, position, item_id")
      .eq("pipeline_id", vacancy.pipeline_id)
      .eq("item_type", "candidate_application")
      .order("position", { ascending: true }),
  ]);

  const applicationIds = (items ?? []).map((i) => i.item_id as string);
  const { data: applications } = applicationIds.length
    ? await supabase
        .from("candidate_applications")
        .select("id, applied_at, candidates(id, source, contacts(name, avatar_url))")
        .in("id", applicationIds)
    : { data: [] };

  const { data: tasks } = applicationIds.length
    ? await supabase
        .from("tasks")
        .select("title, due_at, related_id")
        .in("related_id", applicationIds)
        .eq("related_type", "candidate_application")
        .is("completed_at", null)
        .order("due_at", { ascending: true })
    : { data: [] };

  const nextActivityByApplication = new Map<string, { title: string; dueAt: string | null }>();
  for (const t of tasks ?? []) {
    const key = t.related_id as string;
    if (!nextActivityByApplication.has(key)) {
      nextActivityByApplication.set(key, { title: t.title as string, dueAt: t.due_at as string | null });
    }
  }

  const applicationById = new Map((applications ?? []).map((a) => [a.id as string, a]));

  const cardsByStage: Record<string, CandidateCard[]> = {};
  for (const stage of stages ?? []) {
    cardsByStage[stage.id as string] = [];
  }

  for (const item of items ?? []) {
    const app = applicationById.get(item.item_id as string);
    if (!app) continue;
    const candidate = Array.isArray(app.candidates) ? app.candidates[0] : app.candidates;
    const contact = candidate ? (Array.isArray(candidate.contacts) ? candidate.contacts[0] : candidate.contacts) : null;
    const stageId = item.stage_id as string;
    const card: CandidateCard = {
      id: app.id as string,
      pipelineItemId: item.id as string,
      stageId,
      position: item.position as number,
      candidateId: candidate?.id as string,
      contactName: contact?.name ?? "Sin nombre",
      contactAvatarUrl: contact?.avatar_url ?? null,
      source: candidate?.source ?? null,
      appliedAt: app.applied_at as string,
      nextActivity: nextActivityByApplication.get(app.id as string) ?? null,
    };
    if (!cardsByStage[stageId]) cardsByStage[stageId] = [];
    cardsByStage[stageId].push(card);
  }

  return {
    vacancy: {
      id: vacancy.id as string,
      title: vacancy.title as string,
      department: vacancy.department as string | null,
      location: vacancy.location as string | null,
      status: vacancy.status as string,
    },
    pipelineId: vacancy.pipeline_id as string,
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

export interface CandidateApplicationDetail {
  id: string;
  appliedAt: string;
  status: string;
  candidate: {
    id: string;
    source: string | null;
    contact: { id: string; name: string; email: string | null; phone: string | null };
  };
  notes: { id: string; body: string; createdAt: string }[];
}

export async function getCandidateApplicationDetail(
  workspaceId: string,
  applicationId: string,
): Promise<CandidateApplicationDetail | null> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("candidate_applications")
    .select("id, applied_at, status, candidates(id, source, contacts(id, name, email, phone))")
    .eq("workspace_id", workspaceId)
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return null;
  const candidate = Array.isArray(app.candidates) ? app.candidates[0] : app.candidates;
  const contact = candidate ? (Array.isArray(candidate.contacts) ? candidate.contacts[0] : candidate.contacts) : null;
  if (!candidate || !contact) return null;

  const { data: notes } = await supabase
    .from("notes")
    .select("id, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("notable_type", "candidate_application")
    .eq("notable_id", applicationId)
    .order("created_at", { ascending: false });

  return {
    id: app.id as string,
    appliedAt: app.applied_at as string,
    status: app.status as string,
    candidate: {
      id: candidate.id as string,
      source: candidate.source as string | null,
      contact: {
        id: contact.id as string,
        name: contact.name as string,
        email: contact.email as string | null,
        phone: contact.phone as string | null,
      },
    },
    notes: (notes ?? []).map((n) => ({
      id: n.id as string,
      body: n.body as string,
      createdAt: n.created_at as string,
    })),
  };
}
