import { randomUUID } from "node:crypto";
import { config } from "./config.js";

/**
 * Posts inbound message/status events to the Next.js webhook
 * (`src/app/api/webhooks/whatsapp-web/route.ts`), which reuses the exact
 * same contact/conversation/message/buffer ingestion the YCloud webhook uses
 * (`src/lib/messaging/ingest.ts`) — this worker never touches those tables
 * directly, keeping ONE ingestion implementation for both providers.
 */
async function postToWebhook(body: Record<string, unknown>): Promise<void> {
  const eventId = randomUUID();
  try {
    const res = await fetch(`${config.nextAppUrl.replace(/\/$/, "")}/api/webhooks/whatsapp-web`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.webhookSecret}` },
      body: JSON.stringify({ eventId, ...body }),
    });
    if (!res.ok) {
      console.error(`[messages] webhook POST rejected (HTTP ${res.status}):`, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[messages] network error posting to the Next.js webhook:", err);
  }
}

export interface InboundMessageContext {
  workspaceId: string;
  memberId: string;
  sessionId: string;
}

export async function forwardInboundMessage(
  ctx: InboundMessageContext,
  message: {
    chatId: string;
    fromPhone: string | null;
    businessNumber: string;
    profileName?: string | null;
    avatarUrl?: string | null;
    body: string;
    externalId: string;
  },
): Promise<void> {
  await postToWebhook({
    workspaceId: ctx.workspaceId,
    memberId: ctx.memberId,
    sessionId: ctx.sessionId,
    type: "message",
    message,
  });
}

export async function forwardStatusUpdate(
  ctx: InboundMessageContext,
  statusUpdate: { externalId: string; status: string },
): Promise<void> {
  await postToWebhook({
    workspaceId: ctx.workspaceId,
    memberId: ctx.memberId,
    sessionId: ctx.sessionId,
    type: "status",
    statusUpdate,
  });
}
