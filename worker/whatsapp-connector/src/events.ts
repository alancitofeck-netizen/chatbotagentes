import { DisconnectReason, type WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import { supabase } from "./supabase.js";
import { forwardInboundMessage, forwardStatusUpdate, type InboundMessageContext } from "./messages.js";

const QR_TTL_MS = 20_000; // Baileys rotates the QR roughly every 20s until scanned.

export interface SessionCallbacks {
  /** Recoverable close (network drop, restart-required, timeout) — caller
   * should reconnect using the SAME creds, with backoff. */
  onRecoverableClose: () => void;
  /** Terminal — the phone unlinked this session. Never auto-retry; the
   * user must scan a fresh QR. */
  onLoggedOut: () => void;
}

async function updateSessionRow(sessionId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_web_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) console.error(`[events] failed to update whatsapp_web_sessions ${sessionId}:`, error);
}

/**
 * Baileys' full inbound/status/QR/connection surface for one socket. Kept
 * as its own module (per the plan) even though it's only ever called from
 * sessionManager.ts, so the event-shape logic (QR encoding, disconnect
 * classification, message extraction) stays isolated from socket lifecycle
 * orchestration/reconnection bookkeeping.
 */
export function registerSessionEvents(
  sock: WASocket,
  ctx: InboundMessageContext,
  callbacks: SessionCallbacks,
): void {
  const { sessionId } = ctx;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrData = await QRCode.toDataURL(qr);
        await updateSessionRow(sessionId, {
          status: "qr_pending",
          qr_data: qrData,
          qr_expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
        });
      } catch (err) {
        console.error(`[events] failed to encode QR for session ${sessionId}:`, err);
      }
      return;
    }

    if (connection === "open") {
      const jid = sock.user?.id ?? "";
      const phoneE164 = jid ? `+${jid.split("@")[0]?.split(":")[0]}` : null;
      await updateSessionRow(sessionId, {
        status: "connected",
        phone_e164: phoneE164,
        device_name: sock.user?.name ?? null,
        qr_data: null,
        qr_expires_at: null,
        last_connected_at: new Date().toISOString(),
        disconnect_reason: null,
      });
      return;
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        await updateSessionRow(sessionId, {
          status: "logged_out",
          last_disconnected_at: new Date().toISOString(),
          disconnect_reason: "logged_out",
          qr_data: null,
          qr_expires_at: null,
        });
        callbacks.onLoggedOut();
        return;
      }

      // Any other close reason (network drop, restart-required, timeout,
      // socket replaced, etc.) is recoverable — the caller reconnects with
      // the same creds. The DB row stays 'connecting' during the retry
      // window; sessionManager flips it to 'disconnected' only once retries
      // are exhausted, so a brief blip never surfaces as a scary status.
      callbacks.onRecoverableClose();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return; // skip historical sync ('append') and corrections ('replace')

    for (const msg of messages) {
      // Messages Baileys reports as fromMe are either ones we already sent
      // via sock.sendMessage (src/sessionManager.ts's send path — already
      // persisted through Growth Link's own outbound flow) or messages the
      // human typed directly on their linked phone (out of scope this
      // pass) — never re-ingest either as a new inbound message.
      if (msg.key.fromMe) continue;
      if (!msg.key.remoteJid || !msg.key.remoteJid.endsWith("@s.whatsapp.net")) continue; // skip groups/broadcasts/status

      const body = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text;
      if (!body) continue; // non-text content — out of scope this pass, architecture allows adding it later

      const fromPhone = `+${msg.key.remoteJid.split("@")[0]}`;
      const businessNumber = sock.user?.id ? `+${sock.user.id.split("@")[0]?.split(":")[0]}` : "";
      const externalId = msg.key.id ?? "";
      if (!externalId) continue;

      await forwardInboundMessage(ctx, {
        fromPhone,
        businessNumber,
        profileName: msg.pushName ?? null,
        body,
        externalId,
      });
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const { key, update } of updates) {
      if (!key.id || !update.status) continue;
      // Baileys' numeric WAMessageStatus doesn't map 1:1 to YCloud's
      // status vocabulary the rest of the app already understands
      // (sent/delivered/read/failed) — normalize here so
      // ingestWhatsAppStatusUpdate (src/lib/messaging/ingest.ts) never has
      // to know which provider a status came from.
      const status = mapMessageStatus(update.status);
      if (!status) continue;
      await forwardStatusUpdate(ctx, { externalId: key.id, status });
    }
  });
}

/** Baileys' WAMessageStatus enum: ERROR=0, PENDING=1, SERVER_ACK=2,
 * DELIVERY_ACK=3, READ=4, PLAYED=5. */
function mapMessageStatus(numericStatus: number): string | null {
  switch (numericStatus) {
    case 0:
      return "failed";
    case 2:
      return "sent";
    case 3:
      return "delivered";
    case 4:
    case 5:
      return "read";
    default:
      return null;
  }
}
