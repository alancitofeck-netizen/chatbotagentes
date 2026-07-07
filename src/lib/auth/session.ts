import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
