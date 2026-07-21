import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeE164, resolveWorkspaceIdForYCloudAccount } from "@/lib/integrations/ycloud";
import { DEFAULT_BUFFER_WINDOW_SECONDS } from "@/lib/ai/bufferConfig";

/**
 * YCloud (WhatsApp Business API) webhook receiver.
 *
 * This pass (docs/blueprint/04-inbox.md "Flujo de mensaje entrante") wires
 * `whatsapp.inbound_message.received` events to the core Inbox tables
 * (contacts/conversations/messages). Deliberately NOT implemented yet:
 * signature verification (see verifyYCloudSignature below), the
 * `webhook_events` idempotency table (a lighter wamid-based dedup check is
 * used instead, see processInboundMessage), the Buffer Inteligente, and any
 * AI/automation dispatch — those are separate, later passes.
 *
 * Envelope shape per the Blueprint: `{ id, type, apiVersion, createTime, <event-specific key> }`,
 * e.g. `type: "whatsapp.inbound_message.received"` carries a `whatsappInboundMessage` key.
 *
 * Body is read as raw text first (not `request.json()`) because HMAC/signature
 * verification, when implemented, must hash the exact raw bytes YCloud sent —
 * the request body stream can only be consumed once, so this has to be the
 * first read no matter what.
 */

/**
 * ⚠️ Documented Blueprint gap (08-integrations.md, 12-security-audit.md #5):
 * YCloud's public docs don't specify a webhook signature/HMAC mechanism.
 * Planned mitigation once confirmed with YCloud support: a static secret
 * header (compared with `crypto.timingSafeEqual`, never `===`, to avoid
 * timing attacks) as the primary check, with the webhook's URL path secret
 * as defense-in-depth. Until that's confirmed, this always returns `true` —
 * every request is accepted. Do not treat this endpoint as authenticated
 * until this function is actually implemented.
 */
function verifyYCloudSignature(request: NextRequest, rawBody: string): boolean {
  void request;
  void rawBody;
  return true;
}

/**
 * Shape per docs/blueprint/08-integrations.md's YCloud section. Only the
 * fields this pass actually reads are typed — YCloud's real payload almost
 * certainly carries more (e.g. a contact profile name), but the exact field
 * for that was NOT confirmed against a real captured payload, so it's read
 * defensively below (several plausible paths, falling back to the phone
 * number) rather than assumed.
 */
interface YCloudWebhookEnvelope {
  id?: string;
  type?: string;
  apiVersion?: string;
  createTime?: string;
  whatsappInboundMessage?: {
    id?: string;
    wamid?: string;
    wabaId?: string;
    from?: string;
    fromUserId?: string;
    to?: string;
    sendTime?: string;
    type?: string;
    text?: { body?: string };
    // Unconfirmed field names for the sender's WhatsApp profile name —
    // read defensively, never assumed to exist.
    fromName?: string;
    profile?: { name?: string };
    contact?: { name?: string };
  };
  // Shape confirmed against real captured `whatsapp.message.updated` payloads
  // (not just the Blueprint's paraphrase) — `wamid` can be ABSENT when a send
  // is rejected before WhatsApp assigns one (e.g. the display-name-approval
  // error below never got a wamid), so `id` (→ messages.external_id) is the
  // only field reliably present on every event.
  whatsappMessage?: {
    id?: string;
    wamid?: string;
    status?: string;
    from?: string;
    to?: string;
    errorCode?: string;
    errorMessage?: string;
    updateTime?: string;
  };
  // whatsapp.template.reviewed — no `id` field on this object (confirmed
  // against YCloud's docs), so matching against our own whatsapp_templates
  // row uses the (wabaId, name, language) composite key instead, same fields
  // this object actually carries.
  whatsappTemplate?: {
    wabaId?: string;
    name?: string;
    language?: string;
    category?: string;
    status?: string;
    reason?: string;
    statusUpdateEvent?: string;
  };
}

async function processInboundMessage(
  supabase: ReturnType<typeof createServiceRoleClient>,
  msg: NonNullable<YCloudWebhookEnvelope["whatsappInboundMessage"]>,
) {
  if (!msg.to) {
    console.error("[ycloud-webhook] inbound message has no `to` — cannot resolve workspace, dropping.", msg);
    return;
  }

  const workspaceId = await resolveWorkspaceIdForYCloudAccount(supabase, msg.to);
  if (!workspaceId) {
    console.error(
      `[ycloud-webhook] no integration_connections row for provider='ycloud', external_account_id='${msg.to}' — ` +
        "message dropped. Add a row mapping this YCloud number to a workspace before it can be processed.",
    );
    return;
  }

  if (msg.type && msg.type !== "text") {
    console.log(`[ycloud-webhook] message type "${msg.type}" isn't handled yet (only "text" is this pass) — skipping.`);
    return;
  }

  if (!msg.from) {
    console.error("[ycloud-webhook] inbound message has no `from`, dropping.", msg);
    return;
  }

  // Idempotency: YCloud may retry webhook delivery. A lighter substitute for
  // the full webhook_events table (deliberately out of scope for this pass) —
  // if a message with this wamid already exists in this workspace, it was
  // already processed, so skip re-inserting it.
  if (msg.wamid) {
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("wamid", msg.wamid)
      .maybeSingle();
    if (existingMessage) {
      console.log(`[ycloud-webhook] wamid "${msg.wamid}" already processed, skipping duplicate delivery.`);
      return;
    }
  }

  const phone = normalizeE164(msg.from);
  const profileName = msg.fromName?.trim() || msg.profile?.name?.trim() || msg.contact?.name?.trim();
  const messageBody = msg.text?.body ?? "";

  // 1. Contact: find by phone, create only if missing — never overwrite an
  // existing contact's name/company/etc. on every incoming message.
  const { data: existingContact, error: findContactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("phone", phone)
    .maybeSingle();
  if (findContactError) {
    console.error("[ycloud-webhook] failed to look up contact:", findContactError);
    return;
  }

  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id as string;
  } else {
    const { data: newContact, error: createContactError } = await supabase
      .from("contacts")
      .insert({
        workspace_id: workspaceId,
        phone,
        name: profileName || phone,
        source: "whatsapp",
        whatsapp_opt_status: "subscribed",
      })
      .select("id")
      .single();
    if (createContactError || !newContact) {
      console.error("[ycloud-webhook] failed to create contact:", createContactError);
      return;
    }
    contactId = newContact.id as string;
    console.log(`[ycloud-webhook] created contact ${contactId} for ${phone}`);
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
    console.error("[ycloud-webhook] failed to look up conversation:", findConversationError);
    return;
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
        whatsapp_phone_number_id: msg.to,
        status: "open",
        mode: "human",
        assigned_user_id: null,
        last_message_at: nowIso,
      })
      .select("id")
      .single();
    if (createConversationError || !newConversation) {
      console.error("[ycloud-webhook] failed to create conversation:", createConversationError);
      return;
    }
    conversationId = newConversation.id as string;
    console.log(`[ycloud-webhook] created conversation ${conversationId} for contact ${contactId}`);
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
      external_id: msg.id ?? null,
      wamid: msg.wamid ?? null,
      status: "received",
    })
    .select("id")
    .single();
  if (createMessageError || !newMessage) {
    console.error("[ycloud-webhook] failed to create message:", createMessageError);
    return;
  }

  console.log(`[ycloud-webhook] stored message ${newMessage.id} in conversation ${conversationId}`);

  // Buffer Inteligente (docs/blueprint/04-inbox.md, Motor de IA Fase 2):
  // push this message into conversation_buffers instead of dispatching to
  // the AI engine directly — a scheduled flush (src/app/api/cron/flush-buffers)
  // groups consecutive messages from the same contact into one turn.
  const { error: bufferError } = await supabase.rpc("push_conversation_buffer_message", {
    p_conversation_id: conversationId,
    p_workspace_id: workspaceId,
    p_message_id: newMessage.id,
    p_window_seconds: DEFAULT_BUFFER_WINDOW_SECONDS,
  });
  if (bufferError) {
    console.error(`[ycloud-webhook] failed to push message ${newMessage.id} into conversation_buffers:`, bufferError);
  }
}

/**
 * Handles `whatsapp.message.updated` — status transitions (accepted → sent →
 * delivered → read, or → failed) for a message THIS app already sent via
 * /api/messages/send. Only ever UPDATEs the existing row, never inserts —
 * "no duplicar mensajes" per the user's explicit ask. Matched by
 * `external_id` (YCloud's own `id`, always present) first, falling back to
 * `wamid` only if that lookup misses (wamid can be absent on early failures).
 *
 * Error details (code + message) are folded into `messages.content.error` —
 * there's no dedicated error column, and `content` is already the flexible
 * jsonb slot for this row, so no migration is needed to "save error info if
 * the current architecture allows it".
 *
 * Workspace resolution mirrors processInboundMessage's rule (never trust the
 * counterparty's number) — here `from` is OUR business number (the one that
 * sent the original message), so it's resolved the same way `to` is for
 * inbound events.
 */
async function processMessageStatusUpdate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  msg: NonNullable<YCloudWebhookEnvelope["whatsappMessage"]>,
) {
  if (!msg.id) {
    console.error("[ycloud-webhook] message status update has no `id` — cannot match a message, dropping.", msg);
    return;
  }
  if (!msg.from) {
    console.error("[ycloud-webhook] message status update has no `from` — cannot resolve workspace, dropping.", msg);
    return;
  }

  const workspaceId = await resolveWorkspaceIdForYCloudAccount(supabase, msg.from);
  if (!workspaceId) {
    console.error(
      `[ycloud-webhook] no integration_connections row for provider='ycloud', external_account_id='${msg.from}' — ` +
        "status update dropped.",
    );
    return;
  }

  let existing = await supabase
    .from("messages")
    .select("id, content")
    .eq("workspace_id", workspaceId)
    .eq("external_id", msg.id)
    .maybeSingle();

  if (!existing.data && msg.wamid) {
    existing = await supabase
      .from("messages")
      .select("id, content")
      .eq("workspace_id", workspaceId)
      .eq("wamid", msg.wamid)
      .maybeSingle();
  }

  if (!existing.data) {
    console.error(
      `[ycloud-webhook] no message found for external_id='${msg.id}'` +
        (msg.wamid ? ` / wamid='${msg.wamid}'` : "") +
        " — status update dropped (nothing to update, and this handler never inserts).",
    );
    return;
  }

  const currentContent = (existing.data.content as { body?: string; error?: unknown } | null) ?? {};
  const nextContent =
    msg.status === "failed" && msg.errorMessage
      ? { ...currentContent, error: { code: msg.errorCode ?? null, message: msg.errorMessage } }
      : currentContent;

  const update: { content: typeof nextContent; status?: string; wamid?: string } = { content: nextContent };
  if (msg.status) update.status = msg.status;
  if (msg.wamid) update.wamid = msg.wamid; // fill in if it arrived later than the original send response

  await supabase.from("messages").update(update).eq("id", existing.data.id);

  console.log(
    `[ycloud-webhook] updated message ${existing.data.id} → status="${msg.status}"` +
      (msg.errorMessage ? ` (${msg.errorMessage})` : ""),
  );
}

/** Handles `whatsapp.template.reviewed` — syncs local whatsapp_templates
 * status (0032_whatsapp_templates.sql) with Meta's review outcome. Matched
 * by (wabaId, name, language), the only identifying fields this webhook
 * payload carries (no template id) — deliberately NOT reusing
 * resolveWorkspaceIdForYCloudAccount (that matches by phone-number id, not
 * wabaId, and would never hit here); the target row already has its own
 * workspace_id from creation time, so no cross-tenant resolution is needed. */
async function processTemplateReviewed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  tpl: NonNullable<YCloudWebhookEnvelope["whatsappTemplate"]>,
): Promise<void> {
  if (!tpl.wabaId || !tpl.name || !tpl.language || !tpl.status) {
    console.error("[ycloud-webhook] template.reviewed missing required fields:", tpl);
    return;
  }

  const status = tpl.status.toUpperCase() === "APPROVED" ? "approved" : tpl.status.toUpperCase() === "REJECTED" ? "rejected" : "pending";

  const { data, error } = await supabase
    .from("whatsapp_templates")
    .update({ status, rejection_reason: tpl.reason ?? null, updated_at: new Date().toISOString() })
    .eq("waba_id", tpl.wabaId)
    .eq("name", tpl.name)
    .eq("language", tpl.language)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[ycloud-webhook] failed to update template status:", error);
    return;
  }
  if (!data) {
    console.warn(`[ycloud-webhook] no local template matched (waba=${tpl.wabaId}, name=${tpl.name}, lang=${tpl.language}) — ignoring.`);
    return;
  }
  console.log(`[ycloud-webhook] template ${tpl.name}/${tpl.language} → status="${status}"`);
}

/** Dispatches by event `type`. `whatsapp.inbound_message.received`,
 * `whatsapp.message.updated`, and `whatsapp.template.reviewed` are handled —
 * quality updates, contact events, etc. are still logged and ignored
 * (docs/blueprint/08-integrations.md lists them, none are wired up yet). */
async function processYCloudEvent(payload: unknown): Promise<void> {
  const event = payload as YCloudWebhookEnvelope;
  const supabase = createServiceRoleClient();

  if (event?.type === "whatsapp.inbound_message.received") {
    const msg = event.whatsappInboundMessage;
    if (!msg) {
      console.error('[ycloud-webhook] type is "whatsapp.inbound_message.received" but whatsappInboundMessage is missing:', event);
      return;
    }
    await processInboundMessage(supabase, msg);
    return;
  }

  if (event?.type === "whatsapp.message.updated") {
    const msg = event.whatsappMessage;
    if (!msg) {
      console.error('[ycloud-webhook] type is "whatsapp.message.updated" but whatsappMessage is missing:', event);
      return;
    }
    await processMessageStatusUpdate(supabase, msg);
    return;
  }

  if (event?.type === "whatsapp.template.reviewed") {
    const tpl = event.whatsappTemplate;
    if (!tpl) {
      console.error('[ycloud-webhook] type is "whatsapp.template.reviewed" but whatsappTemplate is missing:', event);
      return;
    }
    await processTemplateReviewed(supabase, tpl);
    return;
  }

  console.log(`[ycloud-webhook] ignoring event type "${event?.type}" — not handled in this pass.`);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    console.error("[ycloud-webhook] received a non-JSON body:", rawBody);
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!verifyYCloudSignature(request, rawBody)) {
    console.warn("[ycloud-webhook] signature verification failed, rejecting");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  console.log("[ycloud-webhook] event received:", JSON.stringify(payload, null, 2));

  const envelope = payload as YCloudWebhookEnvelope;
  const supabase = createServiceRoleClient();

  // Idempotencia real (docs/blueprint/04-inbox.md, Motor de IA Fase 2):
  // YCloud may retry webhook delivery. `webhook_events` unique(provider,
  // event_id) is the authoritative dedup — the lighter wamid-based check
  // inside processInboundMessage stays as defense-in-depth, not replaced.
  if (envelope?.id) {
    const { error: webhookEventError } = await supabase
      .from("webhook_events")
      .insert({ provider: "ycloud", event_id: envelope.id, event_type: envelope.type ?? null, payload: envelope as object });

    if (webhookEventError) {
      if (webhookEventError.code === "23505") {
        console.log(`[ycloud-webhook] event ${envelope.id} already processed, skipping.`);
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      console.error("[ycloud-webhook] failed to record webhook_events row:", webhookEventError);
    }
  }

  await processYCloudEvent(payload);

  if (envelope?.id) {
    await supabase
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "ycloud")
      .eq("event_id", envelope.id);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
