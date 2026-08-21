import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getValidInstagramAccessToken, sendInstagramMessage } from "@/lib/integrations/instagram";
import { notify } from "@/lib/notifications/service";
import type { SendOutboundMessageResult, SendSenderType } from "@/lib/messaging/send";

const FREE_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SendOutboundInstagramMessageInput {
  supabase: SupabaseClient;
  workspaceId: string;
  conversationId: string;
  content: string;
  senderType: SendSenderType;
  senderId: string | null;
}

/**
 * Envío saliente de Instagram — función NUEVA y separada de
 * sendOutboundWhatsAppMessage (src/lib/messaging/send.ts) a propósito:
 * Instagram es un proveedor completamente distinto (API distinta, sin
 * opt-out de WhatsApp) — mezclarlas arriesgaba romper justo lo que no se
 * debía tocar. Mismo shape de resultado ({ok:true|false}) y misma ventana
 * de 24h (confirmada en la documentación pública de Meta: Instagram tiene
 * la misma política de "Standard Messaging Window" que WhatsApp).
 *
 * Fuera de alcance esta pasada (igual que la Fase 2 de media de WhatsApp):
 * adjuntos salientes, tag HUMAN_AGENT (extiende la ventana a 7 días para
 * soporte), estados delivered/read (Instagram no empuja esos eventos al
 * webhook de la misma forma que YCloud — se guarda 'sent' y ya).
 */
export async function sendOutboundInstagramMessage(input: SendOutboundInstagramMessageInput): Promise<SendOutboundMessageResult> {
  const { supabase, workspaceId, conversationId, content, senderType, senderId } = input;

  if (!content.trim()) return { ok: false, error: "missing_fields" };
  // Límite real de Instagram: 1000 BYTES (no caracteres) de texto UTF-8.
  if (Buffer.byteLength(content, "utf8") > 1000) return { ok: false, error: "content_too_long" };

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, channel_thread_id")
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .eq("channel", "instagram")
    .maybeSingle();
  if (conversationError || !conversation) return { ok: false, error: "conversation_not_found" };

  const recipientId = conversation.channel_thread_id as string | null;
  if (!recipientId) return { ok: false, error: "instagram_recipient_unknown" };

  const { data: lastInbound } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const elapsedMs = lastInbound ? Date.now() - new Date(lastInbound.created_at as string).getTime() : Infinity;
  if (elapsedMs > FREE_SESSION_WINDOW_MS) {
    console.warn(`[send-instagram] blocked: conversation ${conversationId} is outside the 24h free-session window.`);
    return { ok: false, error: "outside_24h_window" };
  }

  const serviceClient = createServiceRoleClient();
  const accessToken = await getValidInstagramAccessToken(workspaceId);
  if (!accessToken) return { ok: false, error: "instagram_not_configured" };

  const { data: connection } = await serviceClient
    .from("integration_connections")
    .select("external_account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "instagram")
    .eq("status", "active")
    .maybeSingle();
  const igAccountId = connection?.external_account_id as string | undefined;
  if (!igAccountId) return { ok: false, error: "instagram_not_configured" };

  let sent: { recipientId: string; messageId: string };
  try {
    sent = await sendInstagramMessage(accessToken, igAccountId, recipientId, content);
  } catch (err) {
    console.error("[send-instagram] send failed:", err);
    return { ok: false, error: "instagram_send_failed" };
  }

  const { data: newMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: senderType,
      sender_id: senderId,
      channel: "instagram",
      type: "text",
      content: { body: content },
      external_id: sent.messageId,
      status: "sent",
    })
    .select("id, created_at")
    .single();

  if (insertError || !newMessage) {
    console.error(`[send-instagram] message ACCEPTED by Instagram (id=${sent.messageId}) but persisting it failed:`, insertError);
    return { ok: false, error: "persist_failed" };
  }

  await supabase.from("conversations").update({ last_message_at: newMessage.created_at as string }).eq("id", conversationId);
  await supabase.from("audit_log").insert({
    workspace_id: workspaceId,
    actor_type: senderType === "agent" ? "user" : senderType,
    actor_id: senderId,
    action: "message.sent",
    entity_type: "message",
    entity_id: newMessage.id as string,
    metadata: { conversation_id: conversationId, provider: "instagram" },
  });

  return { ok: true, id: newMessage.id as string, createdAt: newMessage.created_at as string, wamid: null };
}

/** Notifica al remitente si el envío falla — mismo criterio que
 * sendOutboundWhatsAppMessage (envuelve la función real para no repetir
 * este bloque en cada uno de sus early-returns). */
export async function sendOutboundInstagramMessageNotifying(input: SendOutboundInstagramMessageInput): Promise<SendOutboundMessageResult> {
  const result = await sendOutboundInstagramMessage(input);
  if (!result.ok) {
    const recipientId =
      input.senderType === "agent" && input.senderId
        ? input.senderId
        : (await input.supabase.from("conversations").select("assigned_user_id").eq("id", input.conversationId).maybeSingle()).data?.assigned_user_id ?? null;
    if (recipientId) {
      await notify({
        workspaceId: input.workspaceId,
        memberId: recipientId as string,
        eventType: "message_send_failed",
        title: "Error al enviar un mensaje",
        message: `No se pudo enviar el mensaje de Instagram (${result.error}).`,
        actionUrl: "/inbox",
      });
    }
  }
  return result;
}
