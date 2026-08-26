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

export type StartWhatsAppWebSessionResult = { ok: true; sessionId: string } | { ok: false; error: string };

/** Starts a brand-new connection or resumes/reconnects an existing one — la
 * RPC decide cuál (fresh_login) según el estado actual de la sesión.
 *
 * Devuelve `{ok,error}` en vez de tirar — un `throw` acá cruzaría el límite
 * de la Server Action, y en producción Next.js redacta ese mensaje a un
 * cartel genérico ("An error occurred in the Server Components render...")
 * SIN IMPORTAR que el caller lo envuelva en try/catch (gotcha ya
 * documentado en este proyecto). El worker puede tardar/estar caído — eso
 * es un error esperable del mundo real, no una excepción de programación,
 * así que el llamador necesita el texto real para poder mostrarlo. */
export async function startWhatsAppWebSessionAction(targetMemberId?: string): Promise<StartWhatsAppWebSessionResult> {
  try {
    const { workspaceId, role } = await requireActiveWorkspace();
    const supabase = await createClient();
    const ownMemberId = await getCurrentMemberId(workspaceId);
    const memberId = targetMemberId ?? ownMemberId;
    if (!memberId) return { ok: false, error: "No se pudo resolver tu membresía en este workspace." };

    await assertCanManage(workspaceId, role, ownMemberId, memberId);

    const { data, error } = await supabase
      .rpc("provision_whatsapp_web_session", { p_workspace_id: workspaceId, p_member_id: memberId })
      .single();
    if (error || !data) {
      console.error("[whatsappWeb] provision_whatsapp_web_session failed:", error);
      return { ok: false, error: "No se pudo iniciar la conexión de WhatsApp Web." };
    }

    const { session_id: sessionId, fresh_login: freshLogin } = data as { session_id: string; fresh_login: boolean };
    await startWorkerSession(sessionId, workspaceId, memberId, !freshLogin);

    revalidatePath("/profile");
    return { ok: true, sessionId };
  } catch (err) {
    console.error("[whatsappWeb] startWhatsAppWebSessionAction failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo iniciar la conexión de WhatsApp Web." };
  }
}

export async function reconnectWhatsAppWebSessionAction(targetMemberId: string): Promise<StartWhatsAppWebSessionResult> {
  return startWhatsAppWebSessionAction(targetMemberId);
}

export async function disconnectWhatsAppWebSessionAction(sessionId: string, targetMemberId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { workspaceId, role } = await requireActiveWorkspace();
    const ownMemberId = await getCurrentMemberId(workspaceId);
    await assertCanManage(workspaceId, role, ownMemberId, targetMemberId);

    await logoutWorkerSession(sessionId);
    revalidatePath("/profile");
    return { ok: true };
  } catch (err) {
    console.error("[whatsappWeb] disconnectWhatsAppWebSessionAction failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo desconectar." };
  }
}
