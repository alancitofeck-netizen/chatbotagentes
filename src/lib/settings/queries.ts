import "server-only";
import { createClient } from "@/lib/supabase/server";

const MODULE_KEYS = ["crm", "ats", "advisors", "mini_apps", "tasks", "insurance_prospects", "policies", "advisory_sessions"] as const;
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

/** Server-side module gate — CRM/ATS/Advisors today rely only on RLS +
 * Sidebar hiding, with no explicit guard at the top of their own actions;
 * Mini Apps adds this real check (docs/blueprint/03-modules.md's 3-layer
 * enforcement) so a stale bookmark/tab into a disabled module can't call
 * server actions at all, not just fail to navigate there via the UI. */
export async function assertModuleEnabled(workspaceId: string, moduleKey: ModuleKey): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_modules")
    .select("enabled")
    .eq("workspace_id", workspaceId)
    .eq("module_key", moduleKey)
    .maybeSingle();
  if (!data?.enabled) throw new Error("Este módulo no está activo para este workspace.");
}

export interface WorkspaceMember {
  memberId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
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

  return ((names ?? []) as { member_id: string; full_name: string; email: string; avatar_url: string | null }[])
    .map((n) => ({
      memberId: n.member_id,
      fullName: n.full_name,
      email: n.email,
      avatarUrl: n.avatar_url,
      role: roleByMemberId.get(n.member_id) ?? "agent",
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
