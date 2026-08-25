import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ingestInboundWhatsAppMessage, ingestWhatsAppStatusUpdate } from "@/lib/messaging/ingest";
import { isReferralsOnlyModeEnabled, isPhoneAuthorizedReferral } from "@/lib/messaging/referralAuthorization";

/**
 * Receives events from the standalone WhatsApp Web worker
 * (`worker/whatsapp-connector/`) — our own self-hosted equivalent of the
 * YCloud webhook (src/app/api/webhooks/ycloud/route.ts), reusing the exact
 * same ingestion logic (src/lib/messaging/ingest.ts).
 *
 * Unlike YCloud (an external SaaS with an unconfirmed signature scheme —
 * see that route's own comment), this secret is one we fully control end to
 * end, so real auth is implemented from day one: a shared bearer secret,
 * compared with `timingSafeEqual` to avoid timing attacks (never `===`).
 *
 * Workspace resolution is also simpler than YCloud's: the worker already
 * knows exactly which workspace_id/member_id owns a given socket (it's the
 * key of its own in-memory session map), so it sends that directly instead
 * of us reverse-engineering it from a phone number — we still verify the
 * given sessionId genuinely belongs to that workspace before trusting it.
 */
function verifySharedSecret(request: NextRequest): boolean {
  const expected = process.env.WHATSAPP_WEB_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[whatsapp-web-webhook] WHATSAPP_WEB_WEBHOOK_SECRET is not configured — rejecting all requests.");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

interface WhatsAppWebWebhookPayload {
  eventId?: string;
  workspaceId: string;
  memberId: string;
  sessionId: string;
  type: "message" | "status";
  message?: {
    /** Raw WhatsApp chat id — always present, the real identity of the
     * conversation (see 0086_whatsapp_web_chat_id.sql). */
    chatId: string;
    /** Real E.164 phone number, or null when the chat is addressed via
     * WhatsApp's LID (number-privacy) mode. */
    fromPhone: string | null;
    businessNumber: string;
    profileName?: string | null;
    avatarUrl?: string | null;
    body: string;
    externalId: string;
  };
  statusUpdate?: {
    externalId: string;
    status: string;
  };
}

export async function POST(request: NextRequest) {
  if (!verifySharedSecret(request)) {
    console.warn("[whatsapp-web-webhook] shared secret verification failed, rejecting");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: WhatsAppWebWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.workspaceId || !payload.sessionId || !payload.type) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // webhook_events idempotency — same mechanism/table as the YCloud route.
  if (payload.eventId) {
    const { error: webhookEventError } = await supabase
      .from("webhook_events")
      .insert({ provider: "whatsapp_web", event_id: payload.eventId, event_type: payload.type, payload: payload as unknown as object });
    if (webhookEventError) {
      if (webhookEventError.code === "23505") {
        console.log(`[whatsapp-web-webhook] event ${payload.eventId} already processed, skipping.`);
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      console.error("[whatsapp-web-webhook] failed to record webhook_events row:", webhookEventError);
    }
  }

  // Never trust workspaceId/sessionId blindly, even over the shared-secret
  // channel — confirm the session genuinely belongs to that workspace.
  const { data: session } = await supabase
    .from("whatsapp_web_sessions")
    .select("id")
    .eq("id", payload.sessionId)
    .eq("workspace_id", payload.workspaceId)
    .maybeSingle();
  if (!session) {
    console.error(
      `[whatsapp-web-webhook] sessionId ${payload.sessionId} does not belong to workspace ${payload.workspaceId} — dropping.`,
    );
    return NextResponse.json({ error: "unknown_session" }, { status: 404 });
  }

  if (payload.type === "message" && payload.message) {
    // "Solo Referidos CRM" — mismo gate que ycloud/route.ts, ver
    // src/lib/messaging/referralAuthorization.ts. Un chat en modo LID
    // (fromPhone null — WhatsApp oculta el número real) nunca se puede
    // verificar contra asesoria_referrals, así que con el modo activo se
    // descarta por no poder confirmarse, en vez de asumir que está
    // autorizado.
    if (await isReferralsOnlyModeEnabled(supabase, payload.workspaceId)) {
      const authorized = payload.message.fromPhone
        ? await isPhoneAuthorizedReferral(supabase, payload.workspaceId, payload.message.fromPhone)
        : false;
      if (!authorized) {
        console.log(
          `[whatsapp-web-webhook] "Solo Referidos CRM" activo — ${payload.message.fromPhone ?? "(LID, sin número)"} no es un referido autorizado en workspace ${payload.workspaceId}, descartando.`,
        );
        if (payload.eventId) {
          await supabase.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("provider", "whatsapp_web").eq("event_id", payload.eventId);
        }
        return NextResponse.json({ received: true, discarded: "not_authorized_referral" }, { status: 200 });
      }
    }

    await ingestInboundWhatsAppMessage({
      supabase,
      workspaceId: payload.workspaceId,
      chatId: payload.message.chatId,
      fromPhone: payload.message.fromPhone,
      businessNumber: payload.message.businessNumber,
      profileName: payload.message.profileName,
      avatarUrl: payload.message.avatarUrl,
      messageBody: payload.message.body,
      externalId: payload.message.externalId,
      wamid: null,
    });
  } else if (payload.type === "status" && payload.statusUpdate) {
    await ingestWhatsAppStatusUpdate({
      supabase,
      workspaceId: payload.workspaceId,
      externalId: payload.statusUpdate.externalId,
      wamid: null,
      status: payload.statusUpdate.status,
    });
  } else {
    console.warn(`[whatsapp-web-webhook] event type "${payload.type}" missing its expected payload — ignoring.`);
  }

  if (payload.eventId) {
    await supabase
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "whatsapp_web")
      .eq("event_id", payload.eventId);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
