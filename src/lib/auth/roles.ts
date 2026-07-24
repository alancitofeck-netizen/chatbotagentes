import { createClient } from "@/lib/supabase/server";

/** Not a "use server" module — files with that directive can only export
 * async Server Actions, so this plain synchronous check lives here instead,
 * shared by src/lib/settings/actions.ts and src/lib/ai-agents/actions.ts. */
export function requireManagerRole(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("No tenés permiso para hacer esto.");
  }
}

/** Platform admin ("Owner global") check — orthogonal to any single
 * workspace's role, backed by public.platform_admins (see
 * 0039_role_permissions_system.sql). Used to gate the cross-workspace
 * supervisor panel, never to grant write access (RLS keeps platform-admin
 * access read-only regardless of what this returns). */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("am_i_platform_admin");
  return Boolean(data);
}

export async function requirePlatformAdmin() {
  if (!(await isPlatformAdmin())) {
    throw new Error("No tenés permiso para hacer esto.");
  }
}
