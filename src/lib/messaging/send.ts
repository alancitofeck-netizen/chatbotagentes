import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getYCloudCredentials, normalizeE164 } from "@/lib/integrations/ycloud";

export type SendSenderType = "agent" | "ai" | "system";

export interface SendOutboundMessageInput {
  /** Request-scoped client for a human sender, service-role client for
   * ai/system senders (cron/webhook paths have no signed-in user). */
  supabase: SupabaseClient;
  workspaceId: string;
  conversationId: string;
  content: string;
  senderType: SendSenderType;
  /** workspace_members.id, or null for system-originated sends. */
  senderId: string | null;
}

export type SendOutboundMessageResult =
  | { ok: true; id: string; createdAt: string; wamid: string | null }
  | { ok: false; error: string; detail?: unknown };

const FREE_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Single, shared outbound-send path (docs/blueprint/04-inbox.md, "Envío
 * saliente y actualización de estado"): every sender — human, IA,
 * automatización, tool — must go through the exact same checks,
 * unconditionally: opt-out, 24h free-session window, send, persist, audit.
 * Extracted from src/app/api/messages/send/route.ts so the AI/automation
 * paths (Fase 3/4/5 del Motor de IA) reuse this instead of duplicating —
 * or silently skipping — any of it.
 */
export async function sendOutboundWhatsAppMessage(input: SendOutboundMessageInput): Promise<SendOutboundMessageResult> {
  const { supabase, workspaceId, conversationId, content, senderType, senderId } = input;

  if (content.length > 4096) {
    // YCloud's documented limit for `text.body` (docs/blueprint/08-integrations.md).
    return { ok: false, error: "content_too_long" };
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, whatsapp_phone_number_id, contacts(phone, whatsapp_opt_status)")
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (conversationError || !conversation) {
    return { ok: false, error: "conversation_not_found" };
  }

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const contactPhone = contact?.phone as string | undefined;
  const optStatus = contact?.whatsapp_opt_status as string | undefined;

  if (!contactPhone) {
    return { ok: false, error: "contact_missing_phone" };
  }
  if (optStatus === "unsubscribed") {
    console.warn(`[send] blocked: contact for conversation ${conversationId} has opted out.`);
    return { ok: false, error: "contact_unsubscribed" };
  }
  if (!conversation.whatsapp_phone_number_id) {
    return { ok: false, error: "conversation_missing_business_number" };
  }

  // 24h free-session window (docs/blueprint/09-security.md): WhatsApp only
  // allows a free-form text send within 24h of the contact's last inbound
  // message — outside that window, a pre-approved template is required. This
  // app has no template support yet, so outside the window every sender is
  // rejected. This closes a gap the pre-Motor-de-IA composer left open
  // (flagged there as "not implemented yet", not silently skipped here).
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
    console.warn(`[send] blocked: conversation ${conversationId} is outside the 24h free-session window (no template support yet).`);
    return { ok: false, error: "outside_24h_window" };
  }

  const credentials = await getYCloudCredentials(createServiceRoleClient(), workspaceId);
  if (!credentials) {
    console.error(`[send] no active YCloud integration configured for workspace ${workspaceId}.`);
    return { ok: false, error: "ycloud_not_configured" };
  }

  const fromNumber = normalizeE164(conversation.whatsapp_phone_number_id as string);
  const toNumber = normalizeE164(contactPhone);

  let ycloudMessage: { id?: string; wamid?: string; status?: string };
  try {
    const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
      method: "POST",
      headers: { "X-API-Key": credentials.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromNumber, to: toNumber, type: "text", text: { body: content } }),
    });
    const data = await res.json();
    console.log(`[send] YCloud response (HTTP ${res.status}):`, JSON.stringify(data, null, 2));
    if (!res.ok) {
      console.error("[send] YCloud rejected the send:", res.status, data);
      return { ok: false, error: "ycloud_send_failed", detail: data };
    }
    ycloudMessage = data;
  } catch (err) {
    console.error("[send] network error calling YCloud:", err);
    return { ok: false, error: "ycloud_network_error" };
  }

  if (ycloudMessage.status === "failed") {
    console.error('[send] YCloud accepted the request but reports status="failed":', ycloudMessage);
    return { ok: false, error: "ycloud_send_failed", detail: ycloudMessage };
  }

  // YCloud accepted the send — persist. If this fails, the message is truly
  // sent (irreversible) but invisible in the Inbox; log loudly, matching the
  // resilience rule in 08-integrations.md.
  const { data: newMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: senderType,
      sender_id: senderId,
      type: "text",
      content: { body: content },
      external_id: ycloudMessage.id ?? null,
      wamid: ycloudMessage.wamid ?? null,
      status: ycloudMessage.status ?? "sent",
    })
    .select("id, created_at")
    .single();

  if (insertError || !newMessage) {
    console.error(
      `[send] YCloud ACCEPTED the message (wamid=${ycloudMessage.wamid}) but persisting it failed — ` +
        "it was really sent and won't show in the Inbox:",
      insertError,
    );
    return { ok: false, error: "persist_failed" };
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: newMessage.created_at as string })
    .eq("id", conversationId);

  await supabase.from("audit_log").insert({
    workspace_id: workspaceId,
    actor_type: senderType === "agent" ? "user" : senderType,
    actor_id: senderId,
    action: "message.sent",
    entity_type: "message",
    entity_id: newMessage.id as string,
    metadata: { conversation_id: conversationId },
  });

  return {
    ok: true,
    id: newMessage.id as string,
    createdAt: newMessage.created_at as string,
    wamid: ycloudMessage.wamid ?? null,
  };
}
