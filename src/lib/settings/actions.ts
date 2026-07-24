"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getWorkspaceMembersList, getWorkspaceModuleStatus, type ModuleKey } from "@/lib/settings/queries";

const VALID_ROLES = ["owner", "admin", "agent"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function getWorkspaceModuleStatusAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getWorkspaceModuleStatus(workspaceId);
}

export async function getWorkspaceMembersListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getWorkspaceMembersList(workspaceId);
}

export async function toggleModule(moduleKey: ModuleKey, enabled: boolean) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();

  await supabase
    .from("workspace_modules")
    .upsert(
      { workspace_id: workspaceId, module_key: moduleKey, enabled, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,module_key" },
    );

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

/** No `invites` table exists (not in the Blueprint) — this reuses the same
 * Supabase Auth admin primitives already exercised this session for
 * password-less login during verification. `inviteUserByEmail` both creates
 * the auth user (if new) and sends Supabase's default invite email; if the
 * email already has an account, that call errors and we fall back to
 * `generateLink` (doesn't send anything, just resolves the existing user's
 * id) so they can be added directly — they'll see this workspace next time
 * they log in via /select-workspace. workspace_members has no insert policy
 * for the normal client (0001_workspaces_and_members.sql), so both paths
 * must use the service-role client — hence the explicit owner/admin check
 * above, since service-role bypasses RLS entirely. */
export async function inviteMember(email: string, role: Role) {
  const { workspaceId, role: actingRole } = await requireActiveWorkspace();
  requireManagerRole(actingRole);

  const trimmedEmail = email.trim();
  if (!trimmedEmail) throw new Error("El email es obligatorio.");
  if (!VALID_ROLES.includes(role)) throw new Error("Rol inválido.");

  const serviceClient = createServiceRoleClient();

  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(trimmedEmail);

  let userId: string;
  if (inviteError || !inviteData.user) {
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email: trimmedEmail,
    });
    if (linkError || !linkData.user) {
      throw new Error(inviteError?.message ?? "No se pudo invitar a este email.");
    }
    userId = linkData.user.id;
  } else {
    userId = inviteData.user.id;
  }

  const { error: memberError } = await serviceClient
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role });

  if (memberError) {
    if (memberError.code === "23505") throw new Error("Ese usuario ya es miembro de este workspace.");
    throw new Error("No se pudo agregar el miembro.");
  }

  revalidatePath("/settings");
}

async function countOwners(workspaceId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "owner");
  return count ?? 0;
}

async function getTargetMember(workspaceId: string, memberId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data;
}

export async function updateMemberRole(memberId: string, role: Role) {
  const { workspaceId, role: actingRole } = await requireActiveWorkspace();
  requireManagerRole(actingRole);
  if (!VALID_ROLES.includes(role)) throw new Error("Rol inválido.");

  const ownMemberId = await getCurrentMemberId(workspaceId);
  if (ownMemberId && ownMemberId === memberId) {
    throw new Error("No podés cambiar tu propio rol.");
  }

  const target = await getTargetMember(workspaceId, memberId);
  if (!target) throw new Error("Miembro no encontrado en este workspace.");

  if (target.role === "owner" && role !== "owner" && (await countOwners(workspaceId)) <= 1) {
    throw new Error("No podés quitar el rol de owner al único owner del workspace.");
  }

  const supabase = await createClient();
  await supabase.from("workspace_members").update({ role }).eq("id", memberId).eq("workspace_id", workspaceId);
  revalidatePath("/settings");
}

export async function removeMember(memberId: string) {
  const { workspaceId, role: actingRole } = await requireActiveWorkspace();
  requireManagerRole(actingRole);

  const target = await getTargetMember(workspaceId, memberId);
  if (!target) throw new Error("Miembro no encontrado en este workspace.");

  if (target.role === "owner" && (await countOwners(workspaceId)) <= 1) {
    throw new Error("No podés quitar al único owner del workspace.");
  }

  const supabase = await createClient();
  await supabase.from("workspace_members").delete().eq("id", memberId).eq("workspace_id", workspaceId);
  revalidatePath("/settings");
}
