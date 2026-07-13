"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getMyProfile, getMySessions } from "@/lib/profile/queries";

export async function getMyProfileAction() {
  return getMyProfile();
}

export async function getMySessionsAction() {
  return getMySessions();
}

export async function updateMyProfile(input: { fullName: string; username: string; phone: string }) {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("El nombre completo es obligatorio.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName, username: input.username.trim(), phone: input.phone.trim() },
  });
  if (error) throw new Error("No se pudo actualizar el perfil.");

  revalidatePath("/profile");
}

/** Supabase's default behavior for an authenticated session: no need to
 * re-enter the current password first (there's no "old password" check
 * built into updateUser — the valid session itself is the authorization). */
export async function changeMyPassword(newPassword: string) {
  if (newPassword.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error("No se pudo cambiar la contraseña.");
}

/** Invalidates every session for this user EXCEPT the one making this call
 * — Supabase resolves "current" from the request's own refresh token
 * server-side, so nothing needs to be passed in to identify it. */
export async function signOutOtherSessions() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw new Error("No se pudieron cerrar las otras sesiones.");
}

export async function updateWorkspaceName(name: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre del workspace es obligatorio.");

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").update({ name: trimmed }).eq("id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el nombre del workspace.");

  revalidatePath("/profile");
}
