import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveWorkspaceIdForInstagramAccount } from "@/lib/integrations/instagram";
import { ingestInboundWhatsAppMessage } from "@/lib/messaging/ingest";

/**
 * Webhook oficial de Instagram Messaging — a diferencia de YCloud (cuya
 * verificación de firma nunca se implementó, gap documentado en
 * src/app/api/webhooks/ycloud/route.ts), acá se implementa de entrada: Meta
 * documenta el mecanismo con precisión (X-Hub-Signature-256, HMAC-SHA256
 * sobre el body crudo con el App Secret).
 *
 * Idempotencia: NO se usa la tabla `webhook_events` (pensada para un id de
 * evento único por POST, como YCloud) — un solo POST de Instagram puede
 * traer varios mensajes en `entry[].messaging[]`. La dedup real pasa por
 * `messages.external_id` (el `mid` de cada mensaje), ya verificada dentro
 * de ingestInboundWhatsAppMessage (src/lib/messaging/ingest.ts) — mismo
 * mecanismo que YCloud/WhatsApp Web ya usan.
 *
 * Shape del payload verificado contra la documentación pública de Meta
 * (developers.facebook.com/docs/messenger-platform/reference/webhook-events/messages),
 * NO contra un payload real capturado — código defensivo, un campo
 * inesperado descarta ese mensaje puntual (se loguea) en vez de tirar.
 */

interface InstagramMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: unknown[];
  };
}

interface InstagramWebhookEntry {
  id?: string; // IG_ID de la cuenta profesional conectada
  time?: number;
  messaging?: InstagramMessagingEvent[];
}

interface InstagramWebhookPayload {
  object?: string;
  entry?: InstagramWebhookEntry[];
}

/** Handshake de verificación — Meta llama a esto UNA vez al configurar el
 * webhook en el Developer Console. */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expectedToken && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

/** HMAC-SHA256 sobre el body crudo, comparación timing-safe — nunca `===`
 * directo sobre strings (vulnerable a timing attacks), mismo criterio que
 * el resto de las comparaciones de secretos en el proyecto. */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

async function processMessagingEvent(supabase: ReturnType<typeof createServiceRoleClient>, workspaceId: string, igAccountId: string, event: InstagramMessagingEvent) {
  // Eco de un mensaje que ESTA app ya envió por la API — nunca se re-ingiere
  // como si fuera entrante (mismo criterio que msg.fromMe en whatsapp-web.js).
  if (event.message?.is_echo) return;
  if (!event.sender?.id || !event.message?.mid) {
    console.error("[instagram-webhook] messaging event missing sender.id or message.mid — dropping.", event);
    return;
  }
  // Adjuntos (imagen/audio/video) quedan fuera de esta pasada — se guarda
  // solo el texto, si lo hay, en vez de descartar el mensaje entero.
  const messageBody = event.message.text ?? "";
  if (!messageBody && (!event.message.attachments || event.message.attachments.length === 0)) return;

  await ingestInboundWhatsAppMessage({
    supabase,
    workspaceId,
    channel: "instagram",
    chatId: event.sender.id, // reusado como channel_thread_id — ver ingest.ts
    fromPhone: null,
    instagramUserId: event.sender.id,
    businessNumber: igAccountId,
    messageBody: messageBody || "[adjunto]",
    externalId: event.message.mid,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    console.warn("[instagram-webhook] signature verification failed, rejecting");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: InstagramWebhookPayload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.object !== "instagram") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const supabase = createServiceRoleClient();

  for (const entry of payload.entry ?? []) {
    if (!entry.id) continue;
    const workspaceId = await resolveWorkspaceIdForInstagramAccount(entry.id);
    if (!workspaceId) {
      console.error(`[instagram-webhook] no active integration_connections row for IG account '${entry.id}' — entry dropped.`);
      continue;
    }
    for (const event of entry.messaging ?? []) {
      try {
        await processMessagingEvent(supabase, workspaceId, entry.id, event);
      } catch (err) {
        console.error("[instagram-webhook] failed to process messaging event:", err);
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
