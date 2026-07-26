"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { startWorkerSession, logoutWorkerSession } from "@/lib/whatsappWeb/workerClient";
import { getWhatsAppWebSessions } from "@/lib/whatsappWeb/queries";

/** Mirrors the permission rule enforced inside `provision_whatsapp_web_session`
 * (0050_whatsapp_web_sessions.sql) — defense in depth, so a disallowed click
 * fails fast with a clear message instead of round-tripping to the DB/worker
 * first. Owner: any connection. Admin: any connection except the Owner's
 * own. Agent: only their own (confirmed with the user). */
async function assertCanManage(workspaceId: string, currentRole: string, ownMemberId: string | null, targetMemberId: string) {
  if (ownMemberId && targetMemberId === ownMemberId) return;
  if (currentRole === "owner") return;
  if (currentRole === "admin") {
    const supabase = await createClient();
    const { data: target } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("id", targetMemberId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (target?.role !== "owner") return;
  }
  throw new Error("No tenés permiso para administrar esta conexión de WhatsApp Web.");
}

export async function getWhatsAppWebSessionsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getWhatsAppWebSessions(workspaceId);
}

/** Starts a brand-new connection or resumes/reconnects an existing one — the
 * RPC decides which (fresh_login) based on the session's current status. */
export async function startWhatsAppWebSessionAction(targetMemberId?: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const supabase = await createClient();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  const memberId = targetMemberId ?? ownMemberId;
  if (!memberId) throw new Error("No se pudo resolver tu membresía en este workspace.");

  await assertCanManage(workspaceId, role, ownMemberId, memberId);

  const { data, error } = await supabase
    .rpc("provision_whatsapp_web_session", { p_workspace_id: workspaceId, p_member_id: memberId })
    .single();
  if (error || !data) {
    console.error("[whatsappWeb] provision_whatsapp_web_session failed:", error);
    throw new Error("No se pudo iniciar la conexión de WhatsApp Web.");
  }

  const { session_id: sessionId, fresh_login: freshLogin } = data as { session_id: string; fresh_login: boolean };
  await startWorkerSession(sessionId, workspaceId, memberId, !freshLogin);

  revalidatePath("/profile");
  return { sessionId };
}

export async function reconnectWhatsAppWebSessionAction(targetMemberId: string) {
  return startWhatsAppWebSessionAction(targetMemberId);
}

export async function disconnectWhatsAppWebSessionAction(sessionId: string, targetMemberId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  await assertCanManage(workspaceId, role, ownMemberId, targetMemberId);

  await logoutWorkerSession(sessionId);
  revalidatePath("/profile");
}
