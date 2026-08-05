import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdvisoryStep, AdvisoryStatus } from "@/lib/advisorySessions/constants";

export { type AdvisoryStep, type AdvisoryStatus };

export interface AdvisorySessionListItem {
  id: string;
  contactId: string | null;
  contactName: string | null;
  ownerName: string | null;
  status: AdvisoryStatus;
  currentStep: AdvisoryStep;
  branchKey: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const LIST_SELECT =
  "id, contact_id, owner_id, status, current_step, branch_key, started_at, updated_at, completed_at, contacts(name)";

export async function getAdvisorySessionList(workspaceId: string): Promise<AdvisorySessionListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("advisory_sessions").select(LIST_SELECT).eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  const rows = data ?? [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = ownerIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>((memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]));

  return rows.map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id as string,
      contactId: r.contact_id as string | null,
      contactName: (contact?.name as string | undefined) ?? null,
      ownerName: r.owner_id ? (nameByMember.get(r.owner_id as string) ?? null) : null,
      status: r.status as AdvisoryStatus,
      currentStep: r.current_step as AdvisoryStep,
      branchKey: r.branch_key as string | null,
      startedAt: r.started_at as string,
      updatedAt: r.updated_at as string,
      completedAt: r.completed_at as string | null,
    };
  });
}

export interface AdvisorySessionDetail {
  id: string;
  workspaceId: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: AdvisoryStatus;
  currentStep: AdvisoryStep;
  profileData: Record<string, unknown>;
  discoveryData: Record<string, unknown>;
  branchKey: string | null;
  branchAnswers: Record<string, unknown>;
  aiAnalysis: Record<string, unknown> | null;
  summaryNotes: string | null;
  policyId: string | null;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

const DETAIL_SELECT =
  "id, workspace_id, contact_id, owner_id, status, current_step, profile_data, discovery_data, branch_key, branch_answers, ai_analysis, summary_notes, policy_id, started_at, completed_at, updated_at, contacts(name, phone, email)";

export async function getAdvisorySessionById(workspaceId: string, sessionId: string): Promise<AdvisorySessionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("advisory_sessions").select(DETAIL_SELECT).eq("workspace_id", workspaceId).eq("id", sessionId).maybeSingle();
  if (!data) return null;

  const contact = Array.isArray(data.contacts) ? data.contacts[0] : data.contacts;
  let ownerName: string | null = null;
  if (data.owner_id) {
    const { data: memberNames } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
    ownerName = ((memberNames ?? []) as { member_id: string; full_name: string }[]).find((m) => m.member_id === data.owner_id)?.full_name ?? null;
  }

  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    contactId: data.contact_id as string | null,
    contactName: (contact?.name as string | undefined) ?? null,
    contactPhone: (contact?.phone as string | null) ?? null,
    contactEmail: (contact?.email as string | null) ?? null,
    ownerId: data.owner_id as string | null,
    ownerName,
    status: data.status as AdvisoryStatus,
    currentStep: data.current_step as AdvisoryStep,
    profileData: (data.profile_data as Record<string, unknown> | null) ?? {},
    discoveryData: (data.discovery_data as Record<string, unknown> | null) ?? {},
    branchKey: data.branch_key as string | null,
    branchAnswers: (data.branch_answers as Record<string, unknown> | null) ?? {},
    aiAnalysis: (data.ai_analysis as Record<string, unknown> | null) ?? null,
    summaryNotes: data.summary_notes as string | null,
    policyId: data.policy_id as string | null,
    startedAt: data.started_at as string,
    completedAt: data.completed_at as string | null,
    updatedAt: data.updated_at as string,
  };
}
