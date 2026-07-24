import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function slugify(base: string) {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${cleaned || "workspace"}-${suffix}`;
}

/**
 * Idempotent: if the user already belongs to a workspace, does nothing.
 * Called from src/app/(auth)/confirm-email/actions.ts right after a signup
 * OTP code confirms the account (docs/blueprint plan decision #2 — every
 * user gets a personal workspace automatically so the workspace-selection
 * architecture is exercised from day one, even with a single workspace).
 *
 * Role is "agent", never "owner" — the platform has exactly one global
 * Owner (public.platform_admins, manually assigned), and every self-service
 * signup only ever administers their own Workspace as an agent (per the
 * corrected architecture: no automatic Owner assignment, ever). CRM and
 * Asesores are enabled immediately, not left for the new agent to toggle —
 * module activation is owner/admin-only (requireManagerRole,
 * src/lib/settings/actions.ts), and a solo agent-only workspace has no
 * owner/admin member who could ever turn them on otherwise.
 *
 * Returns the resolved workspace id (existing or newly created) — used by
 * the Google sign-in callback (src/app/api/auth/google/callback/route.ts)
 * to know where to store the Google OAuth grant right after provisioning,
 * without a second round-trip. Existing callers that ignore the return
 * value are unaffected.
 */
export async function provisionDefaultWorkspaceIfNeeded(userId: string, email: string): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.workspace_id as string;

  const baseName = email.split("@")[0] ?? "Mi workspace";
  const workspaceName = `Workspace de ${baseName}`;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({ name: workspaceName, slug: slugify(baseName) })
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    throw new Error(`No se pudo crear el workspace inicial: ${workspaceError?.message}`);
  }

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: userId, role: "agent" });

  if (memberError) {
    throw new Error(`No se pudo asignar el workspace al usuario: ${memberError.message}`);
  }

  const { error: modulesError } = await supabase.from("workspace_modules").insert([
    { workspace_id: workspace.id, module_key: "crm", enabled: true },
    { workspace_id: workspace.id, module_key: "advisors", enabled: true },
  ]);

  if (modulesError) {
    throw new Error(`No se pudieron habilitar los módulos iniciales: ${modulesError.message}`);
  }

  return workspace.id as string;
}
