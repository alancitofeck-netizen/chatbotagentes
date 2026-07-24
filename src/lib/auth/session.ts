import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";

export type WorkspaceRole = "owner" | "admin" | "agent";

export interface WorkspaceMembership {
  workspaceId: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  /** True when this membership is synthetic — a platform admin ("Owner
   * global") viewing a workspace they don't actually belong to, resolved via
   * the is_platform_admin() RLS carve-out rather than a real
   * workspace_members row. Always paired with role "agent" so any
   * role === "owner" / "admin" UI gate stays correctly locked for them —
   * supervision is read-only by design (see 0039_role_permissions_system.sql). */
  isSupervising?: boolean;
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

/** Resolves a workspace by id for a platform admin ("Owner global") who is
 * supervising it, not a member of it. Works with the plain (non
 * service-role) client because 0039_role_permissions_system.sql extends
 * core.is_workspace_member() to also return true for platform admins —
 * "workspaces_select_own" (0001_workspaces_and_members.sql) already grants
 * read access on that same check, so no new RLS policy was needed. Returns
 * null (rather than throwing) for a non-admin or an unknown workspace id, so
 * callers can fall back to the normal "not found" path. */
async function getSupervisedWorkspace(workspaceId: string): Promise<WorkspaceMembership | null> {
  const supabase = await createClient();
  const { data: isPlatformAdmin } = await supabase.rpc("am_i_platform_admin");
  if (!isPlatformAdmin) return null;

  const { data: workspace } = await supabase.from("workspaces").select("id, name, slug").eq("id", workspaceId).maybeSingle();
  if (!workspace) return null;

  return {
    workspaceId: workspace.id as string,
    name: workspace.name as string,
    slug: workspace.slug as string,
    role: "agent",
    isSupervising: true,
  };
}

/** Redirect-free core of requireActiveWorkspace — used by Route Handlers
 * (e.g. src/app/api/messages/send/route.ts), where a `redirect()` would be
 * wrong (an API route must return a JSON 401/403, not an HTTP redirect). */
export async function getActiveWorkspaceForUser(userId: string): Promise<WorkspaceMembership | null> {
  const workspaces = await getUserWorkspaces(userId);
  const activeWorkspaceId = await getActiveWorkspaceCookie();
  if (!activeWorkspaceId) return null;

  const own = workspaces.find((w) => w.workspaceId === activeWorkspaceId);
  if (own) return own;

  return getSupervisedWorkspace(activeWorkspaceId);
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

/** Resolves the current user's own workspace_members.id (distinct from
 * auth.users.id) within a given workspace — needed anywhere RLS/ownership is
 * scoped by member_id rather than user_id (e.g. conversation_reads). Same
 * lookup previously done ad-hoc in src/app/api/messages/send/route.ts,
 * centralized here since src/lib/inbox/actions.ts needs it too. */
export async function getCurrentMemberId(workspaceId: string): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Resolves the WORKSPACE's own display name — its earliest-created
 * workspace_members row, independent of role — never the signed-in caller's.
 * Same "usuario principal" heuristic as getAllWorkspacesForSupervision
 * (src/lib/platform/queries.ts): a self-service signup's registrant is
 * always role "agent" (provision-workspace.ts), never "owner", so "the
 * owner" doesn't reliably exist — "first member" is the only heuristic that
 * always resolves to someone.
 *
 * Exists because requireUser()/getUser().user_metadata is the signed-in
 * caller's OWN identity — correct for "my account" surfaces (Sidebar's
 * account menu, /profile), but wrong for anything meant to reflect "whose
 * workspace is this", which during Modo Supervisor is a different person
 * entirely. Any screen rendering a workspace-scoped greeting/identity must
 * call this instead of reading the caller's own user_metadata directly (see
 * DashboardPage, the bug this was written to fix).
 *
 * Uses the plain RLS-scoped client, not service-role: workspace_members'
 * select policy and workspace_member_names' SECURITY DEFINER body both key
 * off core.is_workspace_member(), which 0039_role_permissions_system.sql
 * extends to also allow a supervising platform admin — so this resolves
 * correctly for both a real member viewing their own workspace and an admin
 * supervising someone else's, with no special-casing needed here. */
export async function getWorkspacePrimaryUserName(workspaceId: string): Promise<string> {
  const supabase = await createClient();

  const { data: earliestMember } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!earliestMember) return "";

  const { data: names } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  const match = ((names ?? []) as { user_id: string; full_name: string }[]).find(
    (n) => n.user_id === earliestMember.user_id,
  );
  return match?.full_name ?? "";
}
