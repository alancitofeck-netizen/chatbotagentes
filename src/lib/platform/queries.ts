import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PlatformWorkspaceSummary {
  workspaceId: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
}

/** Owner global's cross-workspace list (src/app/(protected)/admin/workspaces/page.tsx).
 * Uses the PLAIN client, not the service role, for the workspaces/
 * workspace_members reads themselves — 0039_role_permissions_system.sql
 * extends core.is_workspace_member() so a platform admin's session passes
 * RLS for every row of both tables, no filter needed. The service role is
 * only used afterwards, to resolve each owner's display name/email from
 * auth.users (no cross-workspace "names" RPC exists for that). */
export async function getAllWorkspacesForSupervision(): Promise<PlatformWorkspaceSummary[]> {
  const supabase = await createClient();
  const [{ data: workspaces }, { data: members }] = await Promise.all([
    supabase.from("workspaces").select("id, name, slug, created_at").order("created_at", { ascending: false }),
    supabase.from("workspace_members").select("workspace_id, role, user_id"),
  ]);
  if (!workspaces) return [];

  const membersByWorkspace = new Map<string, { role: string; user_id: string }[]>();
  for (const m of members ?? []) {
    const list = membersByWorkspace.get(m.workspace_id as string) ?? [];
    list.push({ role: m.role as string, user_id: m.user_id as string });
    membersByWorkspace.set(m.workspace_id as string, list);
  }

  const ownerUserIds = new Set<string>();
  for (const list of membersByWorkspace.values()) {
    const owner = list.find((m) => m.role === "owner");
    if (owner) ownerUserIds.add(owner.user_id);
  }

  const serviceClient = createServiceRoleClient();
  const ownerInfoByUserId = new Map<string, { name: string; email: string }>();
  await Promise.all(
    [...ownerUserIds].map(async (userId) => {
      const { data } = await serviceClient.auth.admin.getUserById(userId);
      if (data?.user) {
        ownerInfoByUserId.set(userId, {
          name: (data.user.user_metadata?.full_name as string | undefined) || data.user.email || "—",
          email: data.user.email ?? "—",
        });
      }
    }),
  );

  return workspaces.map((w) => {
    const list = membersByWorkspace.get(w.id as string) ?? [];
    const owner = list.find((m) => m.role === "owner");
    const ownerInfo = owner ? ownerInfoByUserId.get(owner.user_id) : undefined;
    return {
      workspaceId: w.id as string,
      name: w.name as string,
      slug: w.slug as string,
      createdAt: w.created_at as string,
      ownerName: ownerInfo?.name ?? "—",
      ownerEmail: ownerInfo?.email ?? "—",
      memberCount: list.length,
    };
  });
}
