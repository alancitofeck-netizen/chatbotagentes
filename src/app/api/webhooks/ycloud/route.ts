import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeE164, resolveWorkspaceIdForYCloudAccount, getYCloudCredentials, downloadYCloudMedia } from "@/lib/integrations/ycloud";
import { ingestInboundWhatsAppMessage, ingestWhatsAppStatusUpdate, ingestWhatsAppReaction } from "@/lib/messaging/ingest";
import { isReferralsOnlyModeEnabled, isPhoneAuthorizedReferral } from "@/lib/messaging/referralAuthorization";

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
    // Shape per la documentación pública de YCloud (docs.ycloud.com,
    // "WhatsApp Inbound Message Webhook Examples") — NO confirmado contra un
    // payload real capturado en este proyecto (0 mensajes multimedia
    // recibidos hasta ahora). El casing exacto (`mimeType` vs `mime_type`)
    // hay que confirmarlo contra el log crudo (línea ~294 de este archivo)
    // la primera vez que llegue un mensaje real de este tipo — por eso se
    // leen ambos casings defensivamente en processInboundMessage.
    image?: { id?: string; link?: string; mimeType?: string; mime_type?: string; caption?: string; sha256?: string };
    document?: { id?: string; link?: string; mimeType?: string; mime_type?: string; caption?: string; filename?: string; sha256?: string };
    audio?: { id?: string; link?: string; mimeType?: string; mime_type?: string; sha256?: string };
    // Mensaje citado/respondido — presente en cualquier tipo de mensaje que
    // sea una respuesta a otro.
    context?: { from?: string; id?: string };
    // Reacción a un mensaje — `type` viene como "reaction" y NO trae
    // `text`/`image`/etc, solo esto. `emoji` ausente = el contacto sacó su
    // reacción.
    reaction?: { messageId?: string; message_id?: string; emoji?: string };
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

/** Descarga un adjunto entrante de YCloud y lo re-hospeda en el bucket
 * propio `whatsapp-media` (Storage) — nunca se guarda el `link` de YCloud
 * tal cual, esos links de WhatsApp típicamente expiran. Devuelve null en
 * cualquier fallo (sin credenciales, descarga, o subida) — nunca lanza, el
 * mensaje simplemente se descarta (se loguea) en vez de guardar un mensaje
 * de media a medias. */
async function downloadAndStoreInboundMedia(
  supabase: ReturnType<typeof createServiceRoleClient>,
  workspaceId: string,
  link: string,
  mimeTypeHint: string | undefined,
): Promise<{ mediaPath: string; mimeType: string | null } | null> {
  const credentials = await getYCloudCredentials(supabase, workspaceId);
  if (!credentials) {
    console.error(`[ycloud-webhook] no YCloud credentials for workspace ${workspaceId} — cannot download inbound media.`);
    return null;
  }

  const downloaded = await downloadYCloudMedia(credentials, link);
  if (!downloaded) return null;

  const mimeType = downloaded.contentType ?? mimeTypeHint ?? null;
  const mediaPath = `${workspaceId}/${randomUUID()}`;
  const { error: uploadError } = await supabase.storage.from("whatsapp-media").upload(mediaPath, downloaded.bytes, {
    contentType: mimeType ?? "application/octet-stream",
  });
  if (uploadError) {
    console.error("[ycloud-webhook] failed to store inbound media in Storage:", uploadError);
    return null;
  }

  return { mediaPath, mimeType };
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

  // Reacción: nunca crea una fila nueva, es un UPDATE sobre el mensaje
  // reaccionado — no depende de `from`/contacto (ver ingestWhatsAppReaction).
  if (msg.type === "reaction") {
    const reactionMessageId = msg.reaction?.messageId ?? msg.reaction?.message_id;
    if (!reactionMessageId) {
      console.error("[ycloud-webhook] reaction event has no message_id — dropping.", msg);
      return;
    }
    await ingestWhatsAppReaction({ supabase, workspaceId, wamid: reactionMessageId, emoji: msg.reaction?.emoji ?? null });
    return;
  }

  if (!msg.from) {
    console.error("[ycloud-webhook] inbound message has no `from`, dropping.", msg);
    return;
  }

  const phone = normalizeE164(msg.from);

  // "Solo Referidos CRM" — descartar ANTES de tocar la base si el número no
  // es un referido autorizado (nunca "guardar primero y filtrar después").
  // Ver src/lib/messaging/referralAuthorization.ts.
  if (await isReferralsOnlyModeEnabled(supabase, workspaceId)) {
    const authorized = await isPhoneAuthorizedReferral(supabase, workspaceId, phone);
    if (!authorized) {
      console.log(`[ycloud-webhook] "Solo Referidos CRM" activo — ${phone} no es un referido autorizado en workspace ${workspaceId}, descartando.`);
      return;
    }
  }

  const profileName = msg.fromName?.trim() || msg.profile?.name?.trim() || msg.contact?.name?.trim();

  let messageType = "text";
  let messageBody = msg.text?.body ?? "";
  let mediaPath: string | null = null;
  let mimeType: string | null = null;
  let fileName: string | null = null;

  // Ramificado explícito por tipo (en vez de un `mediaField` genérico) —
  // image/document/audio tienen shapes distintos (solo document tiene
  // `filename`, audio no tiene `caption`), evita narrowing ambiguo de TS
  // sobre una unión de 3 formas.
  if (msg.type === "image" || msg.type === "document" || msg.type === "audio") {
    const link = msg.type === "image" ? msg.image?.link : msg.type === "document" ? msg.document?.link : msg.audio?.link;
    const mimeHint = msg.type === "image" ? (msg.image?.mimeType ?? msg.image?.mime_type) : msg.type === "document" ? (msg.document?.mimeType ?? msg.document?.mime_type) : (msg.audio?.mimeType ?? msg.audio?.mime_type);

    if (!link) {
      console.log(`[ycloud-webhook] inbound "${msg.type}" message has no link — skipping.`, msg);
      return;
    }
    const stored = await downloadAndStoreInboundMedia(supabase, workspaceId, link, mimeHint);
    if (!stored) {
      console.log(`[ycloud-webhook] could not store inbound "${msg.type}" media — skipping message.`);
      return;
    }

    messageType = msg.type;
    mediaPath = stored.mediaPath;
    mimeType = stored.mimeType;
    fileName = msg.type === "document" ? (msg.document?.filename ?? null) : null;
    messageBody = (msg.type === "image" ? msg.image?.caption : msg.type === "document" ? msg.document?.caption : undefined) ?? "";
  } else if (msg.type && msg.type !== "text") {
    console.log(`[ycloud-webhook] message type "${msg.type}" isn't handled yet — skipping.`);
    return;
  }

  // Cita/respuesta — se resuelve a NUESTRO messages.id (no el wamid) antes
  // de pasarlo al ingest, para que la UI no tenga que resolverlo después.
  // Si no se encuentra (ej. cita a un mensaje de antes de este feature), se
  // guarda sin la cita en vez de fallar.
  let quotedMessageId: string | null = null;
  if (msg.context?.id) {
    const { data: quoted } = await supabase.from("messages").select("id").eq("workspace_id", workspaceId).eq("wamid", msg.context.id).maybeSingle();
    quotedMessageId = (quoted?.id as string | undefined) ?? null;
  }

  // Contact/conversation/message/buffer creation is shared with the
  // WhatsApp Web (Baileys) webhook — see src/lib/messaging/ingest.ts.
  await ingestInboundWhatsAppMessage({
    supabase,
    workspaceId,
    fromPhone: phone,
    businessNumber: msg.to,
    profileName,
    messageType,
    messageBody,
    mediaPath,
    mimeType,
    fileName,
    quotedMessageId,
    externalId: msg.id ?? null,
    wamid: msg.wamid ?? null,
  });
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

  // Shared with the WhatsApp Web (Baileys) webhook — see src/lib/messaging/ingest.ts.
  await ingestWhatsAppStatusUpdate({
    supabase,
    workspaceId,
    externalId: msg.id ?? null,
    wamid: msg.wamid ?? null,
    status: msg.status ?? null,
    errorCode: msg.errorCode ?? null,
    errorMessage: msg.errorMessage ?? null,
  });
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
