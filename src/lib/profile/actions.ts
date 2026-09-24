"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getUser, type WorkspaceTheme } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getMyProfile, getMySessions } from "@/lib/profile/queries";

export async function getMyProfileAction() {
  return getMyProfile();
}

export async function getMySessionsAction() {
  return getMySessions();
}

export async function updateMyProfile(input: { fullName: string; username: string; phone: string; bio?: string; title?: string }) {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("El nombre completo es obligatorio.");
  const bio = (input.bio ?? "").trim();
  if (bio.length > 240) throw new Error("La bio no puede tener más de 240 caracteres.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      username: input.username.trim(),
      phone: input.phone.trim(),
      bio,
      title: (input.title ?? "").trim(),
    },
  });
  if (error) throw new Error("No se pudo actualizar el perfil.");

  revalidatePath("/profile");
}

/** The browser already uploaded the cropped image straight to Supabase
 * Storage (`avatars` bucket, public — AvatarUploadDialog.tsx), same
 * upload-then-register-URL pattern as Documents (src/lib/documents/actions.ts).
 * This just persists the resulting public URL into user_metadata.avatar_url
 * — the single place every other module reads it from via
 * public.workspace_member_names (0049_user_avatars.sql), so one upload
 * propagates everywhere automatically. Pass null to remove the photo
 * (falls back to initials everywhere, same as never having uploaded one). */
export async function updateMyAvatar(avatarUrl: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
  if (error) throw new Error("No se pudo actualizar la foto de perfil.");

  revalidatePath("/profile");
  revalidatePath("/crm");
  revalidatePath("/inbox");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
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

/** Tema visual del workspace (Configuración → Apariencia) — mismo patrón que
 * updateWorkspaceName. Distinto del toggle claro/oscuro existente
 * (src/lib/theme/ThemeProvider.tsx, por navegador): esto es la "piel" de
 * marca completa, persistida en DB, aplicada vía data-workspace-theme en
 * (protected)/layout.tsx. */
export async function updateWorkspaceTheme(theme: WorkspaceTheme) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").update({ theme }).eq("id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el tema del workspace.");

  revalidatePath("/profile");
  revalidatePath("/", "layout");
}

/* ================= 2FA (TOTP real vía Supabase Auth) =================
 * `auth.mfa.*` opera sobre la sesión autenticada actual — el cliente SSR
 * por cookies (createClient()) alcanza igual que en el resto de este
 * archivo, no hace falta nada especial para correrlo desde un Server
 * Action. No hay "códigos de recuperación": Supabase MFA no tiene ese
 * concepto — mostrar códigos falsos sería la misma UI engañosa que se
 * descartó a propósito para Facturación. */

export async function listMfaFactorsAction() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return [];
  return (data?.totp ?? []).map((f) => ({ id: f.id, status: f.status, createdAt: f.created_at }));
}

export async function enrollMfaFactor() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw new Error(error.message || "No se pudo iniciar la activación de la verificación en dos pasos.");
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfaEnrollment(factorId: string, code: string) {
  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw new Error(challengeError.message || "No se pudo verificar el código.");
  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (verifyError) throw new Error("Código incorrecto — volvé a intentar.");
  revalidatePath("/profile");
}

export async function unenrollMfaFactor(factorId: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message || "No se pudo desactivar la verificación en dos pasos.");
  revalidatePath("/profile");
}

/* ================= Cuenta: exportar / eliminar ================= */

/** Solo datos propios del usuario (perfil + resumen de sus propias
 * sesiones) — nunca datos de CRM del workspace (contactos/pólizas/etc. son
 * del equipo, no de la persona, y volcarlos filtraría información de otros
 * miembros). Se descarga directo en el navegador (AccountSection.tsx), sin
 * necesidad de un pipeline de envío por email. */
export async function exportMyData() {
  const profile = await getMyProfile();
  const sessions = await getMySessions();
  return {
    exportedAt: new Date().toISOString(),
    profile: {
      fullName: profile.fullName,
      username: profile.username,
      email: profile.email,
      phone: profile.phone,
      bio: profile.bio,
      title: profile.title,
      role: profile.role,
      workspaceName: profile.workspaceName,
      createdAt: profile.createdAt,
    },
    sessions: sessions.map((s) => ({ device: s.userAgent, ip: s.ip, createdAt: s.createdAt, updatedAt: s.updatedAt })),
  };
}

/** Irreversible. Si la cuenta es la única Owner de CUALQUIERA de sus
 * workspaces (no solo el activo — alguien puede ser Owner de más de uno),
 * bloquea con un mensaje claro apuntando a Miembros — reusa la
 * transferencia de ownership real que ya existe (updateMemberRole en
 * settings/actions.ts, RPC transfer_workspace_ownership), no construye
 * nada nuevo ahí. `workspace_members.user_id` tiene `on delete cascade`
 * contra `auth.users` (0001_workspaces_and_members.sql), así que borrar el
 * usuario ya limpia sus membresías solo — no hace falta borrarlas a mano. */
export async function deleteMyAccount() {
  const user = await getUser();
  if (!user) throw new Error("No se pudo identificar la sesión.");

  const supabase = await createClient();
  const { data: ownedRows, error: ownedError } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(name)")
    .eq("user_id", user.id)
    .eq("role", "owner");
  if (ownedError) throw new Error("No se pudo verificar tus workspaces.");

  for (const row of (ownedRows ?? []) as unknown as { workspace_id: string; workspaces: { name: string } | null }[]) {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", row.workspace_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      throw new Error(
        `Sos el único Owner de "${row.workspaces?.name ?? "un workspace"}". Transferí la propiedad desde Miembros antes de eliminar tu cuenta.`,
      );
    }
  }

  const service = createServiceRoleClient();
  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) throw new Error("No se pudo eliminar la cuenta.");
}
