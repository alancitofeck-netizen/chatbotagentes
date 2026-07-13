import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";

export type WorkspaceRole = "owner" | "admin" | "agent" | "viewer";

export interface WorkspaceMembership {
  workspaceId: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

/** Returns the current Supabase user, or null if there is no session. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Same as getUser(), but redirects to /login when there is no session. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** All workspaces the given user belongs to, via workspace_members (docs/blueprint/02-database.md). */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", userId);

  if (error || !data) return [];

  return data
    .map((row) => {
      const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
      if (!workspace) return null;
      return {
        workspaceId: workspace.id as string,
        name: workspace.name as string,
        slug: workspace.slug as string,
        role: row.role as WorkspaceRole,
      };
    })
    .filter((m): m is WorkspaceMembership => m !== null);
}

/** Confirms `workspaceId` is one the user actually belongs to — never trust the cookie value alone. */
export async function isWorkspaceMember(userId: string, workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return Boolean(data);
}

/** Redirect-free core of requireActiveWorkspace — used by Route Handlers
 * (e.g. src/app/api/messages/send/route.ts), where a `redirect()` would be
 * wrong (an API route must return a JSON 401/403, not an HTTP redirect). */
export async function getActiveWorkspaceForUser(userId: string): Promise<WorkspaceMembership | null> {
  const workspaces = await getUserWorkspaces(userId);
  const activeWorkspaceId = await getActiveWorkspaceCookie();
  return workspaces.find((w) => w.workspaceId === activeWorkspaceId) ?? null;
}

/**
 * For pages under (protected)/ that need to know *which* workspace to query.
 * The layout already redirects to /select-workspace if the cookie is missing
 * or invalid, so this re-derives the same membership cheaply rather than
 * threading it through React context.
 */
export async function requireActiveWorkspace(): Promise<WorkspaceMembership> {
  const user = await requireUser();
  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) redirect("/select-workspace");
  return active;
}
