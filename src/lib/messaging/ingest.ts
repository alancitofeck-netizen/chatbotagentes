import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BUFFER_WINDOW_SECONDS } from "@/lib/ai/bufferConfig";

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
  /** Sender's phone, already E.164-normalized. */
  fromPhone: string;
  /** The business/connected number this message arrived on — stored as-is
   * into `conversations.whatsapp_phone_number_id`, the same column both
   * providers share (see `src/lib/messaging/resolveProvider.ts`). */
  businessNumber: string;
  profileName?: string | null;
  messageBody: string;
  /** Provider's own message id — YCloud's `whatsappInboundMessage.id`, or
   * Baileys' `key.id`. Used for idempotency when `wamid` isn't available. */
  externalId?: string | null;
  /** YCloud-only globally-unique WhatsApp message id. Always null for
   * WhatsApp Web (Baileys has no equivalent). */
  wamid?: string | null;
}

export async function ingestInboundWhatsAppMessage(
  input: IngestInboundMessageInput,
): Promise<{ messageId: string; conversationId: string; contactId: string } | null> {
  const { supabase, workspaceId, fromPhone, businessNumber, profileName, messageBody, externalId, wamid } = input;

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

  // 1. Contact: find by phone, create only if missing — never overwrite an
  // existing contact's name/company/etc. on every incoming message.
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

  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id as string;
  } else {
    const { data: newContact, error: createContactError } = await supabase
      .from("contacts")
      .insert({
        workspace_id: workspaceId,
        phone: fromPhone,
        name: profileName?.trim() || fromPhone,
        source: "whatsapp",
        whatsapp_opt_status: "subscribed",
      })
      .select("id")
      .single();
    if (createContactError || !newContact) {
      console.error("[ingest] failed to create contact:", createContactError);
      return null;
    }
    contactId = newContact.id as string;
    console.log(`[ingest] created contact ${contactId} for ${fromPhone}`);
  }

  // 2. Conversation: find an open one for this contact, create only if missing.
  const { data: existingConversation, error: findConversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .eq("status", "open")
    .maybeSingle();
  if (findConversationError) {
    console.error("[ingest] failed to look up conversation:", findConversationError);
    return null;
  }

  const nowIso = new Date().toISOString();
  let conversationId: string;
  if (existingConversation) {
    conversationId = existingConversation.id as string;
    await supabase.from("conversations").update({ last_message_at: nowIso }).eq("id", conversationId);
  } else {
    const { data: newConversation, error: createConversationError } = await supabase
      .from("conversations")
      .insert({
        workspace_id: workspaceId,
        contact_id: contactId,
        whatsapp_phone_number_id: businessNumber,
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

  // 3. Message.
  const { data: newMessage, error: createMessageError } = await supabase
    .from("messages")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "contact",
      sender_id: null,
      type: "text",
      content: { body: messageBody },
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
