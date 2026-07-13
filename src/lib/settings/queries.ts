import "server-only";
import { createClient } from "@/lib/supabase/server";

const MODULE_KEYS = ["crm", "ats", "advisors"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleStatus {
  moduleKey: ModuleKey;
  enabled: boolean;
}

/** Absence of a workspace_modules row for a key means disabled — same
 * convention (protected)/layout.tsx already uses when computing enabledModules. */
export async function getWorkspaceModuleStatus(workspaceId: string): Promise<ModuleStatus[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_modules")
    .select("module_key, enabled")
    .eq("workspace_id", workspaceId);

  const enabledByKey = new Map((data ?? []).map((r) => [r.module_key as string, r.enabled as boolean]));
  return MODULE_KEYS.map((key) => ({ moduleKey: key, enabled: enabledByKey.get(key) ?? false }));
}

export interface WorkspaceMember {
  memberId: string;
  fullName: string;
  email: string;
  role: string;
}

/** Combines public.workspace_member_names (0003_inbox.sql — resolves
 * name/email from auth.users, already used by Inbox) with a plain
 * workspace_members select for `role`, which that RPC doesn't return. */
export async function getWorkspaceMembersList(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createClient();

  const [{ data: names }, { data: members }] = await Promise.all([
    supabase.rpc("workspace_member_names", { ws_id: workspaceId }),
    supabase.from("workspace_members").select("id, role").eq("workspace_id", workspaceId),
  ]);

  const roleByMemberId = new Map((members ?? []).map((m) => [m.id as string, m.role as string]));

  return ((names ?? []) as { member_id: string; full_name: string; email: string }[])
    .map((n) => ({
      memberId: n.member_id,
      fullName: n.full_name,
      email: n.email,
      role: roleByMemberId.get(n.member_id) ?? "viewer",
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
