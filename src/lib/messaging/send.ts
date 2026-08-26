import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getYCloudCredentials, normalizeE164, uploadYCloudMedia } from "@/lib/integrations/ycloud";
import { resolveMessagingProviderForConversation } from "@/lib/messaging/resolveProvider";
import { sendViaWorker } from "@/lib/whatsappWeb/workerClient";
import { notify } from "@/lib/notifications/service";

export type SendSenderType = "agent" | "ai" | "system";

export interface OutboundMediaInput {
  /** Path dentro del bucket `whatsapp-media`, ya subido (ver
   * src/app/api/messages/upload-media/route.ts) — este módulo lo baja de
   * ahí para reenviarlo a YCloud, nunca recibe los bytes directamente. */
  storagePath: string;
  type: "image" | "audio" | "document";
  mimeType: string;
  fileName?: string;
}

export interface SendOutboundMessageInput {
  /** Request-scoped client for a human sender, service-role client for
   * ai/system senders (cron/webhook paths have no signed-in user). */
  supabase: SupabaseClient;
  workspaceId: string;
  conversationId: string;
  /** Texto del mensaje — o el caption cuando `media` viene presente (audio
   * no soporta caption en WhatsApp, se ignora si se manda). Puede ser
   * string vacío solo cuando `media` está presente. */
  content: string;
  /** Adjunto opcional — solo soportado hoy para el proveedor YCloud
   * (WhatsApp Web/Baileys queda fuera de esta pasada, ver plan de Fase 2). */
  media?: OutboundMediaInput;
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
/** Thin wrapper around the real send logic (renamed below) purely to notify
 * on failure without threading a notify() call through every one of its
 * ~8 early-return branches — the recipient is whichever human should know:
 * the agent who tried to send it themselves, falling back to the
 * conversation's assigned agent for ai/system-originated sends. */
export async function sendOutboundWhatsAppMessage(input: SendOutboundMessageInput): Promise<SendOutboundMessageResult> {
  const result = await sendOutboundWhatsAppMessageInner(input);
  if (!result.ok) {
    const recipientId =
      input.senderType === "agent" && input.senderId
        ? input.senderId
        : await getConversationAssignedUserId(input.supabase, input.conversationId);
    if (recipientId) {
      await notify({
        workspaceId: input.workspaceId,
        memberId: recipientId,
        eventType: "message_send_failed",
        title: "Error al enviar un mensaje",
        message: `No se pudo enviar el mensaje (${result.error}).`,
        actionUrl: "/inbox",
      });
    }
  }
  return result;
}

async function getConversationAssignedUserId(supabase: SupabaseClient, conversationId: string): Promise<string | null> {
  const { data } = await supabase.from("conversations").select("assigned_user_id").eq("id", conversationId).maybeSingle();
  return (data?.assigned_user_id as string | null | undefined) ?? null;
}

async function sendOutboundWhatsAppMessageInner(input: SendOutboundMessageInput): Promise<SendOutboundMessageResult> {
  const { supabase, workspaceId, conversationId, content, media, senderType, senderId } = input;

  if (!media && !content.trim()) {
    return { ok: false, error: "missing_fields" };
  }
  if (content.length > 4096) {
    // YCloud's documented limit for `text.body` (docs/blueprint/08-integrations.md).
    return { ok: false, error: "content_too_long" };
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, whatsapp_phone_number_id, whatsapp_web_chat_id, contacts(phone, whatsapp_opt_status)")
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (conversationError || !conversation) {
    return { ok: false, error: "conversation_not_found" };
  }

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  const contactPhone = contact?.phone as string | undefined;
  const optStatus = contact?.whatsapp_opt_status as string | undefined;
  const chatId = conversation.whatsapp_web_chat_id as string | null;

  // Phone is required for YCloud (it has no other addressing concept) but
  // NOT for WhatsApp Web when the conversation already has a known chat id
  // (see 0086_whatsapp_web_chat_id.sql) — a LID (number-privacy) contact may
  // never have a real phone number at all, and can still be replied to
  // directly via chat_id. The provider-specific gate is applied further
  // down, once the provider itself is resolved.
  if (!contactPhone && !chatId) {
    return { ok: false, error: "contact_missing_phone" };
  }
  if (optStatus === "unsubscribed") {
    console.warn(`[send] blocked: contact for conversation ${conversationId} has opted out.`);
    return { ok: false, error: "contact_unsubscribed" };
  }
  if (!conversation.whatsapp_phone_number_id) {
    return { ok: false, error: "conversation_missing_business_number" };
  }

  const serviceClient = createServiceRoleClient();

  // Provider dispatch — always resolved with a service-role client (see
  // resolveProvider.ts's own comment: a plain Agent's RLS-scoped session
  // can't see every workspace_web_sessions row, but this routing decision
  // must, regardless of who's sending). Resolved BEFORE the 24h check below,
  // since that check only applies to one of the two providers.
  const resolution = await resolveMessagingProviderForConversation(
    serviceClient,
    workspaceId,
    conversation.whatsapp_phone_number_id as string | null,
  );
  if (!resolution) {
    console.error(`[send] no active WhatsApp provider (YCloud or WhatsApp Web) configured for workspace ${workspaceId}.`);
    return { ok: false, error: "ycloud_not_configured" };
  }

  // 24h free-session window (docs/blueprint/09-security.md): this is a Meta
  // WhatsApp Business (Cloud API) policy — a business-initiated send outside
  // 24h of the contact's last inbound message requires a pre-approved
  // template, which this app doesn't support yet. It applies ONLY to YCloud
  // (our BSP for that official API). WhatsApp Web (Baileys) is a real
  // personal WhatsApp session, not a Business API integration — it has no
  // such restriction, the same way a person texting from their own phone
  // doesn't need a template to message someone for the first time. Applying
  // this gate to WhatsApp Web too would make any brand-new outbound-first
  // conversation (e.g. the referral opener) permanently unsendable, since a
  // first-ever contact by definition has no prior inbound message at all.
  if (resolution.provider === "ycloud") {
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
  }

  let sentMessage: { externalId: string | null; wamid: string | null; status: string };

  if (resolution.provider === "ycloud") {
    // Unlike WhatsApp Web, YCloud has no chat-id concept — a real phone
    // number is the only way to address a send.
    if (!contactPhone) {
      return { ok: false, error: "contact_missing_phone" };
    }
    const credentials = await getYCloudCredentials(serviceClient, workspaceId);
    if (!credentials) {
      console.error(`[send] no active YCloud integration configured for workspace ${workspaceId}.`);
      return { ok: false, error: "ycloud_not_configured" };
    }

    const fromNumber = normalizeE164(conversation.whatsapp_phone_number_id as string);
    const toNumber = normalizeE164(contactPhone);

    // Con adjunto: bajar de nuestro Storage y subir a YCloud primero (su
    // propia recomendación — "usar el id devuelto en vez de link, por
    // estabilidad", ver ycloud.ts) para obtener el id que va en el body de
    // abajo. Sin adjunto: exactamente el mismo body de texto de siempre.
    let mediaId: string | null = null;
    if (media) {
      const { data: fileBlob, error: downloadError } = await serviceClient.storage.from("whatsapp-media").download(media.storagePath);
      if (downloadError || !fileBlob) {
        console.error("[send] failed to read media from Storage:", downloadError);
        return { ok: false, error: "media_read_failed" };
      }
      const uploaded = await uploadYCloudMedia(credentials, fromNumber, await fileBlob.arrayBuffer(), media.fileName ?? "archivo", media.mimeType);
      if (!uploaded) return { ok: false, error: "ycloud_media_upload_failed" };
      mediaId = uploaded.id;
    }

    const requestBody: Record<string, unknown> = media
      ? {
          from: fromNumber,
          to: toNumber,
          type: media.type,
          [media.type]: {
            id: mediaId,
            ...(media.type !== "audio" && content.trim() ? { caption: content.trim() } : {}),
            ...(media.type === "document" ? { filename: media.fileName ?? "archivo" } : {}),
          },
        }
      : { from: fromNumber, to: toNumber, type: "text", text: { body: content } };

    let ycloudMessage: { id?: string; wamid?: string; status?: string };
    try {
      const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
        method: "POST",
        headers: { "X-API-Key": credentials.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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

    sentMessage = { externalId: ycloudMessage.id ?? null, wamid: ycloudMessage.wamid ?? null, status: ycloudMessage.status ?? "sent" };
  } else if (media) {
    // WhatsApp Web (Baileys) queda fuera de esta pasada — sin soporte de
    // media saliente, mismo alcance que hoy (no es una regresión).
    return { ok: false, error: "media_not_supported_on_whatsapp_web" };
  } else {
    // Prefer the exact chat id this conversation already has (learned from
    // an inbound message, see ingest.ts) — no phone-to-JID resolution
    // needed at all for the normal "reply to someone who already messaged"
    // case. Only falls back to a phone number for an outbound-first
    // conversation that has no chat id yet (e.g. a lead created directly in
    // the CRM who was messaged first, never replied). If neither is
    // available the earlier `contact_missing_phone` gate already caught it.
    const target = chatId ?? normalizeE164(contactPhone as string);
    try {
      const result = await sendViaWorker(resolution.sessionId, target, content);
      if (!result.ok) {
        console.error("[send] WhatsApp Web worker reported failure sending to", target);
        return { ok: false, error: "whatsapp_web_send_failed" };
      }
      sentMessage = { externalId: result.externalId ?? null, wamid: null, status: "sent" };

      // Primer mensaje a un contacto sin chat id conocido todavía (ver
      // comentario de `target` arriba) — el worker acaba de resolver a qué
      // identidad de WhatsApp le mandó realmente (puede ser un @lid si el
      // destinatario tiene la privacidad de número activada). Guardarlo acá
      // es lo que permite que una respuesta futura de ese contacto se
      // reconozca como esta misma conversación en vez de perderse (ver
      // referralAuthorization.ts).
      if (!chatId && result.resolvedChatId) {
        const { error: chatIdError } = await serviceClient
          .from("conversations")
          .update({ whatsapp_web_chat_id: result.resolvedChatId })
          .eq("id", conversationId)
          .is("whatsapp_web_chat_id", null);
        if (chatIdError) console.error("[send] failed to persist resolved whatsapp_web_chat_id:", chatIdError);
      }
    } catch (err) {
      console.error("[send] error calling the WhatsApp Web worker:", err);
      return { ok: false, error: "whatsapp_web_worker_unreachable" };
    }
  }

  // Provider accepted the send — persist. If this fails, the message is
  // truly sent (irreversible) but invisible in the Inbox; log loudly,
  // matching the resilience rule in 08-integrations.md. `content` queda
  // EXACTAMENTE `{ body: content }` sin adjunto (comportamiento sin
  // cambios) — mismo shape que ingest.ts arma del lado entrante.
  const outboundContent: Record<string, unknown> = { body: content };
  if (media) {
    outboundContent.mediaPath = media.storagePath;
    outboundContent.mimeType = media.mimeType;
    outboundContent.fileName = media.fileName ?? null;
  }

  const { data: newMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: senderType,
      sender_id: senderId,
      type: media ? media.type : "text",
      content: outboundContent,
      external_id: sentMessage.externalId,
      wamid: sentMessage.wamid,
      status: sentMessage.status,
    })
    .select("id, created_at")
    .single();

  if (insertError || !newMessage) {
    console.error(
      `[send] the message was ACCEPTED by ${resolution.provider} (external_id=${sentMessage.externalId}) but persisting it failed — ` +
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
    metadata: { conversation_id: conversationId, provider: resolution.provider },
  });

  return {
    ok: true,
    id: newMessage.id as string,
    createdAt: newMessage.created_at as string,
    wamid: sentMessage.wamid,
  };
}
