"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import type { WorkspaceRole } from "@/lib/auth/session";

/**
 * Privacidad por Mini App individual — pedido explícito, sin tocar el
 * comportamiento de las Mini Apps existentes (todas quedan is_private=false,
 * ver 0180_mini_app_privacy.sql). El shape de `mini_app_access` es un calco
 * de `document_permissions` (0019_documents_module.sql,
 * src/lib/documents/actions.ts: shareDocument/unshareDocument) — misma
 * forma, pero acá la RLS de `mini_apps` SÍ la usa para restringir
 * visibilidad de verdad (Documentos no lo hace, es solo metadata ahí).
 */

export interface MiniAppAccessRow {
  memberId: string;
  fullName: string;
  avatarUrl: string | null;
  role: "viewer" | "editor";
}

/** Rol propio del usuario actual sobre esta Mini App (null si no tiene
 * ninguna fila explícita) — usado para decidir si el panel de contenido se
 * muestra editable o solo lectura para un member no-owner/admin. */
export async function getOwnMiniAppAccessRole(miniAppId: string): Promise<"viewer" | "editor" | null> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("mini_app_access").select("role").eq("mini_app_id", miniAppId).eq("member_id", memberId).maybeSingle();
  return (data?.role as "viewer" | "editor" | undefined) ?? null;
}

export async function getMiniAppAccessList(miniAppId: string): Promise<MiniAppAccessRow[]> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("mini_app_access")
    .select("member_id, role")
    .eq("mini_app_id", miniAppId);
  if (!rows || rows.length === 0) return [];

  const { data: memberNames } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  const names = new Map(
    ((memberNames ?? []) as { member_id: string; full_name: string; avatar_url: string | null }[]).map((m) => [
      m.member_id,
      { fullName: m.full_name, avatarUrl: m.avatar_url },
    ]),
  );

  return rows.map((r) => ({
    memberId: r.member_id as string,
    fullName: names.get(r.member_id as string)?.fullName ?? "Miembro",
    avatarUrl: names.get(r.member_id as string)?.avatarUrl ?? null,
    role: r.role as "viewer" | "editor",
  }));
}

export async function grantMiniAppAccessAction(miniAppId: string, memberId: string, role: "viewer" | "editor"): Promise<void> {
  const { role: currentRole } = await requireActiveWorkspace();
  requireManagerRole(currentRole);
  const supabase = await createClient();
  const { error } = await supabase
    .from("mini_app_access")
    .upsert({ mini_app_id: miniAppId, member_id: memberId, role }, { onConflict: "mini_app_id,member_id" });
  if (error) throw new Error("No se pudo otorgar el acceso.");
  revalidatePath(`/mini-apps/${miniAppId}`);
}

export async function revokeMiniAppAccessAction(miniAppId: string, memberId: string): Promise<void> {
  const { role: currentRole } = await requireActiveWorkspace();
  requireManagerRole(currentRole);
  const supabase = await createClient();
  await supabase.from("mini_app_access").delete().eq("mini_app_id", miniAppId).eq("member_id", memberId);
  revalidatePath(`/mini-apps/${miniAppId}`);
}

/**
 * Gate de edición para una Mini App potencialmente privada. Para una Mini
 * App pública (is_private=false — las 13 existentes, y cualquier Mini App
 * nueva creada normalmente) es un no-op deliberado: preserva EXACTAMENTE el
 * comportamiento actual, "cualquier rol de workspace puede editar" (RLS
 * `mini_apps_update` ya lo permite). Solo para is_private=true exige
 * owner/admin, o `role='editor'` en `mini_app_access`.
 */
export async function requireMiniAppEditAccess(workspaceId: string, miniAppId: string, currentRole: WorkspaceRole): Promise<void> {
  const supabase = await createClient();
  const { data: app } = await supabase.from("mini_apps").select("is_private").eq("id", miniAppId).maybeSingle();
  if (!app?.is_private) return;

  if (currentRole === "owner" || currentRole === "admin") return;
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) throw new Error("No se pudo resolver tu membresía en este workspace.");
  const { data } = await supabase
    .from("mini_app_access")
    .select("role")
    .eq("mini_app_id", miniAppId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (data?.role !== "editor") throw new Error("No tenés permiso de edición sobre esta Mini App.");
}
