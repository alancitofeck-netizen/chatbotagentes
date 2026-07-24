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
 */
export async function provisionDefaultWorkspaceIfNeeded(userId: string, email: string) {
  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing) return;

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
    .insert({ workspace_id: workspace.id, user_id: userId, role: "owner" });

  if (memberError) {
    throw new Error(`No se pudo asignar el workspace al usuario: ${memberError.message}`);
  }
}
