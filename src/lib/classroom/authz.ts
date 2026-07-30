import "server-only";
import { requireActiveWorkspace } from "@/lib/auth/session";
import type { WorkspaceRole } from "@/lib/auth/session";

/** Classroom's catalog is global (no workspace_id) — unlike every other
 * module, "can manage" isn't scoped to a specific workspace_id. Management
 * permission is simply the caller's role in their currently active
 * workspace, the same field every other owner/admin gate in this app reads
 * (e.g. src/app/(protected)/crm/agents/[memberId]/page.tsx). Known
 * simplification, confirmed explicitly with the user: any workspace's
 * owner/admin can edit the one shared catalog — there is no per-workspace
 * content isolation for Classroom. Server Actions call this first; RLS
 * (core.is_owner_or_admin(), 0071_classroom_module.sql) is the second,
 * defense-in-depth layer. */
export async function requireClassroomManager(): Promise<{ role: WorkspaceRole }> {
  const { role } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin") throw new Error("No tenés permisos para gestionar el Classroom.");
  return { role };
}

export function canManageClassroom(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}
