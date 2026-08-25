import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BUFFER_WINDOW_SECONDS } from "@/lib/ai/bufferConfig";
import { notify } from "@/lib/notifications/service";

/**
 * Provider-agnostic inbound message ingestion — extracted from
 * `src/app/api/webhooks/ycloud/route.ts`'s `processInboundMessage` (behavior
 * unchanged) so the new WhatsApp Web (Baileys) webhook
 * (`src/app/api/webhooks/whatsapp-web/route.ts`) can reuse the exact same
 * contact/conversation/message/buffer logic instead of duplicating it. Only
 * the caller-specific bits (envelope parsing, workspace resolution by
 * receiving number vs. by socket identity, wamid vs. plain external id) stay
 * in each webhook route.
 */
export interface IngestInboundMessageInput {
  /** Must be a service-role client — both callers run with no signed-in user. */
  supabase: SupabaseClient;
  workspaceId: string;
  /** Raw WhatsApp Web chat id (e.g. "5491122334455@c.us" or
   * "123456789@lid") — null for YCloud, which has no such concept and is
   * correlated by phone alone, same as always. When present, this — not
   * `fromPhone` — is the primary correlation key for finding an existing
   * conversation (see 0086_whatsapp_web_chat_id.sql): a WhatsApp Web contact
   * addressed via LID number-privacy may never have a known phone at all,
   * so phone-based lookup alone would create a duplicate contact on every
   * single message from them. */
  chatId?: string | null;
  /** Sender's phone, E.164-normalized — or null when unknown (WhatsApp Web
   * LID-addressed contact with no real number attached). Never a WhatsApp
   * internal identifier — that's what `chatId` is for. */
  fromPhone: string | null;
  /** "whatsapp" (default) | "instagram" — opcional, default preserva el
   * comportamiento exacto de siempre para los dos callers de WhatsApp que
   * no lo mandan. Cuando es "instagram", `chatId` se reusa tal cual como
   * el `channel_thread_id` genérico (0161_instagram_channel.sql) en vez de
   * `whatsapp_web_chat_id`, y la resolución de contacto busca/crea por
   * `instagram_user_id` en vez de `phone`. */
  channel?: string;
  /** Instagram-scoped ID (IGSID) del contacto — solo cuando channel='instagram'. */
  instagramUserId?: string | null;
  instagramUsername?: string | null;
  /** The business/connected number this message arrived on — stored as-is
   * into `conversations.whatsapp_phone_number_id`, the same column both
   * providers share (see `src/lib/messaging/resolveProvider.ts`). */
  businessNumber: string;
  profileName?: string | null;
  /** Best-effort profile picture URL — set once at contact creation, never
   * overwritten on later messages (same rule as name/company below). */
  avatarUrl?: string | null;
  messageBody: string;
  /** "text" (default) | "image" | "document" | "audio" — todos opcionales
   * y con default "text" a propósito: el webhook de WhatsApp Web (Baileys)
   * no manda ninguno de estos campos todavía (fuera de alcance esta pasada,
   * ver plan de Fase 2), así que su comportamiento queda IDÉNTICO al de
   * antes sin tocar ese caller. */
  messageType?: string;
  /** Path dentro del bucket `whatsapp-media` (ya subido por el caller —
   * src/app/api/webhooks/ycloud/route.ts descarga de YCloud y sube acá
   * ANTES de llamar a este ingest) — null/undefined para texto plano. */
  mediaPath?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  /** `messages.id` propio (no el wamid) de un mensaje citado, ya resuelto
   * por el caller buscando por `context.id` — null si no es una respuesta a
   * nada, o si el mensaje citado no se encontró (nunca falla el ingest por
   * esto, se guarda sin la cita). */
  quotedMessageId?: string | null;
  /** Provider's own message id — YCloud's `whatsappInboundMessage.id`, or
   * WhatsApp Web's own message id. Used for idempotency when `wamid` isn't
   * available. */
  externalId?: string | null;
  /** YCloud-only globally-unique WhatsApp message id. Always null for
   * WhatsApp Web (no equivalent). */
  wamid?: string | null;
}

export async function ingestInboundWhatsAppMessage(
  input: IngestInboundMessageInput,
): Promise<{ messageId: string; conversationId: string; contactId: string } | null> {
  const {
    supabase,
    workspaceId,
    chatId,
    fromPhone,
    businessNumber,
    profileName,
    avatarUrl,
    messageBody,
    channel = "whatsapp",
    instagramUserId,
    instagramUsername,
    messageType,
    mediaPath,
    mimeType,
    fileName,
    quotedMessageId,
    externalId,
    wamid,
  } = input;
  const isWhatsApp = channel === "whatsapp";

  // Idempotency: a retried webhook delivery shouldn't insert the same
  // message twice. Prefer wamid (WhatsApp's own globally-unique id, when
  // present); fall back to the provider's own external id otherwise (the
  // only id WhatsApp Web messages have).
  if (wamid) {
    const { data: existingByWamid } = await supabase
      .from("messages")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("wamid", wamid)
      .maybeSingle();
    if (existingByWamid) {
      console.log(`[ingest] wamid "${wamid}" already processed, skipping duplicate delivery.`);
      return null;
    }
  } else if (externalId) {
    const { data: existingByExternalId } = await supabase
      .from("messages")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("external_id", externalId)
      .maybeSingle();
    if (existingByExternalId) {
      console.log(`[ingest] external_id "${externalId}" already processed, skipping duplicate delivery.`);
      return null;
    }
  }

  const nowIso = new Date().toISOString();
  let conversationId: string | null = null;
  let contactId: string | null = null;
  let assignedUserIdOfExisting: string | null = null;

  // 0. WhatsApp Web: a chat id is always known and always stable —
  // correlate by it FIRST, before ever touching phone. This is what makes a
  // LID (number-privacy) contact with no real phone number work at all: a
  // phone-only lookup would create a brand-new duplicate contact on every
  // single message from them, since there's no phone to match on.
  // Instagram (o cualquier canal no-WhatsApp) reusa `chatId` como el
  // `channel_thread_id` genérico, correlacionando por (channel, thread) en
  // vez de la columna específica de WhatsApp Web.
  if (chatId && isWhatsApp) {
    const { data: existingByChatId } = await supabase
      .from("conversations")
      .select("id, contact_id, assigned_user_id")
      .eq("workspace_id", workspaceId)
      .eq("whatsapp_web_chat_id", chatId)
      .maybeSingle();
    if (existingByChatId) {
      conversationId = existingByChatId.id as string;
      contactId = existingByChatId.contact_id as string;
      assignedUserIdOfExisting = (existingByChatId.assigned_user_id as string | null) ?? null;
      await supabase.from("conversations").update({ last_message_at: nowIso }).eq("id", conversationId);
    }
  } else if (chatId) {
    const { data: existingByThread } = await supabase
      .from("conversations")
      .select("id, contact_id, assigned_user_id")
      .eq("workspace_id", workspaceId)
      .eq("channel", channel)
      .eq("channel_thread_id", chatId)
      .maybeSingle();
    if (existingByThread) {
      conversationId = existingByThread.id as string;
      contactId = existingByThread.contact_id as string;
      assignedUserIdOfExisting = (existingByThread.assigned_user_id as string | null) ?? null;
      await supabase.from("conversations").update({ last_message_at: nowIso }).eq("id", conversationId);
    }
  }

  // 1. Contact: find by phone (WhatsApp) or instagram_user_id (Instagram),
  // create only if missing — never overwrite an existing contact's
  // name/company/etc. on every incoming message. Skipped entirely if step
  // 0 already resolved the contact.
  if (!contactId) {
    if (isWhatsApp && fromPhone) {
      const { data: existingContact, error: findContactError } = await supabase
        .from("contacts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("phone", fromPhone)
        .maybeSingle();
      if (findContactError) {
        console.error("[ingest] failed to look up contact:", findContactError);
        return null;
      }
      contactId = existingContact ? (existingContact.id as string) : null;
    } else if (!isWhatsApp && instagramUserId) {
      const { data: existingContact, error: findContactError } = await supabase
        .from("contacts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("instagram_user_id", instagramUserId)
        .maybeSingle();
      if (findContactError) {
        console.error("[ingest] failed to look up contact:", findContactError);
        return null;
      }
      contactId = existingContact ? (existingContact.id as string) : null;
    }

    if (!contactId) {
      // Never fall back to a raw identifier (phone or chat id) as the
      // contact's name — a real name (pushName) or a plain, honest
      // placeholder, never something that looks like it could be a phone
      // number but isn't.
      const defaultName = isWhatsApp ? "Contacto de WhatsApp" : "Contacto de Instagram";
      const { data: newContact, error: createContactError } = await supabase
        .from("contacts")
        .insert({
          workspace_id: workspaceId,
          phone: isWhatsApp ? fromPhone : null,
          name: profileName?.trim() || instagramUsername?.trim() || defaultName,
          avatar_url: avatarUrl ?? null,
          source: channel,
          whatsapp_opt_status: isWhatsApp ? "subscribed" : "unknown",
          instagram_user_id: isWhatsApp ? null : instagramUserId,
          instagram_username: isWhatsApp ? null : instagramUsername,
        })
        .select("id")
        .single();
      if (createContactError || !newContact) {
        console.error("[ingest] failed to create contact:", createContactError);
        return null;
      }
      contactId = newContact.id as string;
      console.log(`[ingest] created contact ${contactId} for ${fromPhone ?? instagramUserId ?? chatId ?? "(unknown identity)"}`);
    }
  }

  // 2. Conversation: find an active one for this contact, create only if
  // missing. Skipped entirely if step 0 already resolved it via chat_id.
  // "Active" = open OR pending_human (same set src/lib/insights/queries.ts
  // already treats as active) — matching "open" alone was a real bug: an AI
  // handoff (src/lib/ai/escalation.ts sets pending_human) made every
  // following message from that contact create a BRAND NEW conversation
  // instead of continuing the one a human is waiting to answer, silently
  // fragmenting the thread (found in production: one contact had accrued 18
  // separate conversations this way). `.limit(1)` instead of
  // `.maybeSingle()` since existing fragmented data can have more than one
  // active row for a contact — take the most recently active one rather
  // than erroring.
  if (!conversationId) {
    const { data: existingConversations, error: findConversationError } = await supabase
      .from("conversations")
      .select("id, assigned_user_id, whatsapp_web_chat_id")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contactId)
      .in("status", ["open", "pending_human"])
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (findConversationError) {
      console.error("[ingest] failed to look up conversation:", findConversationError);
      return null;
    }
    const existingConversation = existingConversations?.[0] ?? null;

    if (existingConversation) {
      conversationId = existingConversation.id as string;
      assignedUserIdOfExisting = (existingConversation.assigned_user_id as string | null) ?? null;
      const update: { last_message_at: string; whatsapp_web_chat_id?: string } = { last_message_at: nowIso };
      // First time we learn this contact's chat id (e.g. their first message
      // arrived via YCloud, this one via WhatsApp Web) — attach it so the
      // next message from this same chat correlates directly via step 0.
      // Solo aplica a WhatsApp — para otros canales channel_thread_id ya
      // se setea al CREAR la conversación (nunca cambia después).
      if (isWhatsApp && chatId && !existingConversation.whatsapp_web_chat_id) update.whatsapp_web_chat_id = chatId;
      await supabase.from("conversations").update(update).eq("id", conversationId);
    } else {
      const { data: newConversation, error: createConversationError } = await supabase
        .from("conversations")
        .insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          channel,
          whatsapp_phone_number_id: isWhatsApp ? businessNumber : null,
          whatsapp_web_chat_id: isWhatsApp ? (chatId ?? null) : null,
          channel_thread_id: isWhatsApp ? null : (chatId ?? null),
          status: "open",
          // Default to "ai" (not "human") so the Agent Runtime engages new
          // contacts automatically — decisionEngine.ts only skips the model
          // once a human explicitly takes the conversation over (mode→human,
          // docs/blueprint/05-ai-engine.md "Handoff humano").
          mode: "ai",
          assigned_user_id: null,
          last_message_at: nowIso,
        })
        .select("id")
        .single();
      if (createConversationError || !newConversation) {
        console.error("[ingest] failed to create conversation:", createConversationError);
        return null;
      }
      conversationId = newConversation.id as string;
      console.log(`[ingest] created conversation ${conversationId} for contact ${contactId}`);
    }
  }

  // 3. Message. `content` queda EXACTAMENTE `{ body: messageBody }` para
  // texto plano (comportamiento sin cambios) — mediaPath/quotedMessageId
  // solo se agregan cuando el caller los manda.
  const content: Record<string, unknown> = { body: messageBody };
  if (mediaPath) {
    content.mediaPath = mediaPath;
    content.mimeType = mimeType ?? null;
    content.fileName = fileName ?? null;
  }
  if (quotedMessageId) content.quotedMessageId = quotedMessageId;

  const { data: newMessage, error: createMessageError } = await supabase
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "contact",
      sender_id: null,
      channel,
      type: messageType ?? "text",
      content,
      external_id: externalId ?? null,
      wamid: wamid ?? null,
      status: "received",
    })
    .select("id")
    .single();
  if (createMessageError || !newMessage) {
    console.error("[ingest] failed to create message:", createMessageError);
    return null;
  }

  const messageId = newMessage.id as string;
  console.log(`[ingest] stored message ${messageId} in conversation ${conversationId}`);

  // Fase 4 (Agentes IA de Referidos): si el prospecto respondió, cualquier
  // seguimiento programado para ESTA conversación queda sin sentido —
  // cancelar acá es un no-op silencioso para toda conversación que no sea
  // de referidos (nunca va a tener filas en referral_followups). No hace
  // falta un `if` por canal/módulo: el `.eq("conversation_id", ...)` ya
  // acota esto solo a filas que realmente existen.
  await supabase
    .from("referral_followups")
    .update({ status: "cancelled", cancelled_reason: "replied" })
    .eq("conversation_id", conversationId)
    .eq("status", "pending");

  // Buffer Inteligente (docs/blueprint/04-inbox.md, Motor de IA Fase 2): push
  // into conversation_buffers instead of dispatching to the AI engine
  // directly — a scheduled flush groups consecutive messages into one turn.
  const { error: bufferError } = await supabase.rpc("push_conversation_buffer_message", {
    p_conversation_id: conversationId,
    p_workspace_id: workspaceId,
    p_message_id: messageId,
    p_window_seconds: DEFAULT_BUFFER_WINDOW_SECONDS,
  });
  if (bufferError) {
    console.error(`[ingest] failed to push message ${messageId} into conversation_buffers:`, bufferError);
  }

  // Only notify when the conversation already has a human assigned — an
  // unassigned conversation has no single natural recipient in Fase 1 (no
  // "team inbox" broadcast concept yet), same scoping the plan called out.
  if (assignedUserIdOfExisting) {
    await notify({
      workspaceId,
      memberId: assignedUserIdOfExisting,
      eventType: "message_received",
      title: "Nuevo mensaje",
      message: `${profileName?.trim() || fromPhone || instagramUsername || "Un contacto"}: ${messageBody.slice(0, 120)}`,
      actionUrl: "/inbox",
    });
  }

  return { messageId, conversationId, contactId };
}

export interface IngestStatusUpdateInput {
  supabase: SupabaseClient;
  workspaceId: string;
  /** The provider's own id for the message (YCloud's `whatsappMessage.id`,
   * or a WhatsApp Web send's external id) — matched first. */
  externalId?: string | null;
  /** Falls back to matching by wamid if externalId misses (arrives later
   * than the original send response, or wasn't known at send time). */
  wamid?: string | null;
  status?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * Extracted from `processMessageStatusUpdate` in the YCloud webhook route —
 * status transitions (sent → delivered → read, or → failed) for a message
 * THIS app already sent. Only ever UPDATEs an existing row, never inserts.
 */
export async function ingestWhatsAppStatusUpdate(input: IngestStatusUpdateInput): Promise<void> {
  const { supabase, workspaceId, externalId, wamid, status, errorCode, errorMessage } = input;

  if (!externalId && !wamid) {
    console.error("[ingest] status update has no externalId/wamid — cannot match a message, dropping.");
    return;
  }

  let existing: { data: { id: string; content: unknown } | null } = { data: null };
  if (externalId) {
    existing = await supabase
      .from("messages")
      .select("id, content")
      .eq("workspace_id", workspaceId)
      .eq("external_id", externalId)
      .maybeSingle();
  }
  if (!existing.data && wamid) {
    existing = await supabase
      .from("messages")
      .select("id, content")
      .eq("workspace_id", workspaceId)
      .eq("wamid", wamid)
      .maybeSingle();
  }

  if (!existing.data) {
    console.error(
      `[ingest] no message found for external_id='${externalId ?? ""}'` +
        (wamid ? ` / wamid='${wamid}'` : "") +
        " — status update dropped (nothing to update, and this handler never inserts).",
    );
    return;
  }

  const currentContent = (existing.data.content as { body?: string; error?: unknown } | null) ?? {};
  const nextContent =
    status === "failed" && errorMessage ? { ...currentContent, error: { code: errorCode ?? null, message: errorMessage } } : currentContent;

  const update: { content: typeof nextContent; status?: string; wamid?: string } = { content: nextContent };
  if (status) update.status = status;
  if (wamid) update.wamid = wamid;

  await supabase.from("messages").update(update).eq("id", existing.data.id);

  console.log(`[ingest] updated message ${existing.data.id} → status="${status}"` + (errorMessage ? ` (${errorMessage})` : ""));
}

export interface IngestReactionInput {
  supabase: SupabaseClient;
  workspaceId: string;
  /** wamid del mensaje reaccionado (`reaction.message_id` en el payload de
   * YCloud) — WhatsApp Web queda fuera de esta pasada, así que hoy este
   * único caller siempre tiene wamid. */
  wamid: string;
  /** null = el contacto sacó su reacción (mismo criterio que YCloud: emoji
   * ausente significa remover). */
  emoji: string | null;
}

/** Una reacción NUNCA es una fila nueva de `messages` — es un UPDATE sobre
 * el mensaje existente. WhatsApp solo permite una reacción activa por
 * persona por mensaje (una reacción nueva reemplaza la anterior), así que
 * `content.reaction` es un string simple, no un array — no hace falta
 * modelar múltiples reacciones de un mismo contacto. */
export async function ingestWhatsAppReaction(input: IngestReactionInput): Promise<void> {
  const { supabase, workspaceId, wamid, emoji } = input;

  const { data: existing } = await supabase.from("messages").select("id, content").eq("workspace_id", workspaceId).eq("wamid", wamid).maybeSingle();
  if (!existing) {
    console.error(`[ingest] no message found for wamid='${wamid}' — reaction dropped.`);
    return;
  }

  const currentContent = (existing.content as Record<string, unknown> | null) ?? {};
  await supabase
    .from("messages")
    .update({ content: { ...currentContent, reaction: emoji } })
    .eq("id", existing.id);

  console.log(`[ingest] updated message ${existing.id} reaction → ${emoji ?? "(removed)"}`);
}
