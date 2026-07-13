"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getAgentDetail, getAgentList, getTeams } from "@/lib/agents/queries";
import { getMonday } from "@/lib/calendar/week";

export async function getAgentListAction(filters: { teamId?: string; supervisorId?: string; status?: string; search?: string }) {
  const { workspaceId } = await requireActiveWorkspace();
  return getAgentList(workspaceId, filters);
}

export async function getAgentDetailAction(memberId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getAgentDetail(workspaceId, memberId);
}

export async function getTeamsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getTeams(workspaceId);
}

export async function createTeam(name: string, leaderId: string | null) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!name.trim()) throw new Error("El nombre del equipo es obligatorio.");
  const supabase = await createClient();

  await supabase.from("teams").insert({ workspace_id: workspaceId, name: name.trim(), leader_id: leaderId });
  revalidatePath("/crm");
}

export async function updateTeam(teamId: string, input: { name: string; leaderId: string | null }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!input.name.trim()) throw new Error("El nombre del equipo es obligatorio.");
  const supabase = await createClient();

  await supabase
    .from("teams")
    .update({ name: input.name.trim(), leader_id: input.leaderId })
    .eq("id", teamId)
    .eq("workspace_id", workspaceId);
  revalidatePath("/crm");
}

export async function deleteTeam(teamId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();

  await supabase.from("teams").delete().eq("id", teamId).eq("workspace_id", workspaceId);
  revalidatePath("/crm");
}

export async function updateAgentProfile(
  memberId: string,
  input: {
    title: string;
    status: "active" | "vacation" | "inactive";
    teamId: string | null;
    supervisorId: string | null;
    hireDate: string | null;
  },
) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();

  await supabase
    .from("workspace_members")
    .update({
      title: input.title.trim() || null,
      status: input.status,
      team_id: input.teamId,
      supervisor_id: input.supervisorId,
      hire_date: input.hireDate,
    })
    .eq("id", memberId)
    .eq("workspace_id", workspaceId);
  revalidatePath("/crm");
}

/** Only "meetings" per week is supported in this pass (see plan — extensible
 * schema, narrow UI). `periodStart` must be the Monday of the target week. */
export async function setAgentTarget(memberId: string, targetValue: number, periodStart: Date = getMonday(new Date())) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (targetValue < 0) throw new Error("La meta no puede ser negativa.");
  const supabase = await createClient();

  await supabase.from("agent_targets").upsert(
    {
      workspace_id: workspaceId,
      member_id: memberId,
      metric: "meetings",
      period: "week",
      period_start: periodStart.toISOString().slice(0, 10),
      target_value: targetValue,
    },
    { onConflict: "member_id,metric,period,period_start" },
  );
  revalidatePath("/crm");
}

export async function addAgentNote(memberId: string, body: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!body.trim()) return;
  const supabase = await createClient();

  await supabase.from("notes").insert({
    workspace_id: workspaceId,
    notable_type: "workspace_member",
    notable_id: memberId,
    body: body.trim(),
  });
  revalidatePath("/crm");
}
