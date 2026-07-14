"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, requireUser, getUserWorkspaces } from "@/lib/auth/session";
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

/** "Workspaces asignados" tab. `getUserWorkspaces` (src/lib/auth/session.ts)
 * already exists and is RLS-safe for this exact use: `workspace_members`'s
 * own select policy is `core.is_workspace_member(workspace_id)` — it only
 * checks that the CALLER belongs to a given row's workspace, not whose
 * user_id the row is, so querying by an arbitrary target `userId` naturally
 * only returns workspaces the caller also happens to share with that person.
 * No new table/RPC needed — extends the existing model per the confirmed
 * decision (no separate "agency" layer above workspaces). */
export async function getAgentWorkspacesAction(userId: string) {
  return getUserWorkspaces(userId);
}

/** Workspaces the CURRENT user can assign someone into (i.e., where they're
 * owner/admin themselves) — populates the "Agregar a otro workspace" picker,
 * excluding the one already active in this session. */
export async function getMyManageableWorkspacesAction() {
  const { workspaceId: activeWorkspaceId } = await requireActiveWorkspace();
  const user = await requireUser();
  const memberships = await getUserWorkspaces(user.id);
  return memberships.filter((m) => (m.role === "owner" || m.role === "admin") && m.workspaceId !== activeWorkspaceId);
}

/** Adds an existing person (already a member of the caller's active
 * workspace) to a DIFFERENT workspace the caller also manages. Reuses the
 * same service-role insert pattern as inviteMember (src/lib/settings/
 * actions.ts) — `workspace_members` has no INSERT policy at all today, so
 * every member-creation path goes through the service role after an
 * app-level authorization check. Here that check is explicit and scoped to
 * the TARGET workspace (not just "is manager of whatever's active"), since
 * the two can differ. */
export async function assignMemberToWorkspace(userId: string, targetWorkspaceId: string, role: "owner" | "admin" | "agent" | "viewer") {
  const caller = await requireUser();
  const callerMemberships = await getUserWorkspaces(caller.id);
  const callerRoleInTarget = callerMemberships.find((m) => m.workspaceId === targetWorkspaceId)?.role;
  if (callerRoleInTarget !== "owner" && callerRoleInTarget !== "admin") {
    throw new Error("No tenés permiso para agregar miembros a ese workspace.");
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.from("workspace_members").insert({ workspace_id: targetWorkspaceId, user_id: userId, role });
  if (error) {
    if (error.code === "23505") throw new Error("Esa persona ya es miembro de ese workspace.");
    throw new Error("No se pudo asignar el workspace.");
  }
}
