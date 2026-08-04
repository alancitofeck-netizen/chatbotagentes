import { mkdirSync } from "node:fs";
import pkg from "whatsapp-web.js";
const { Client, RemoteAuth, MessageAck } = pkg;
import QRCode from "qrcode";
import { SupabaseStorageStore, resolveSessionEncryptionKey } from "../store/supabaseStorageStore.js";
import { SESSION_DATA_PATH } from "../config.js";
import type { SessionIdentity, WhatsAppService, WhatsAppServiceEvents } from "../whatsAppService.js";

/**
 * The ONLY file in this worker that imports `whatsapp-web.js` — every other
 * module depends solely on the `WhatsAppService` interface
 * (whatsAppService.ts). Swapping providers later (Baileys, Meta Cloud API)
 * means writing a new class here and changing one line in index.ts.
 */

interface ManagedClient {
  client: InstanceType<typeof Client>;
  identity: SessionIdentity;
}

/** whatsapp-web.js's own `MessageAck` numeric enum, compared by name (never
 * magic numbers) — confirmed exported by the library itself. */
function mapAck(ack: number): string | null {
  switch (ack) {
    case MessageAck.ACK_ERROR:
      return "failed";
    case MessageAck.ACK_SERVER:
      return "sent";
    case MessageAck.ACK_DEVICE:
      return "delivered";
    case MessageAck.ACK_READ:
    case MessageAck.ACK_PLAYED:
      return "read";
    default:
      return null; // ACK_PENDING and anything else — not a state we surface
  }
}

export class WhatsAppWebJsProvider implements WhatsAppService {
  private readonly sessions = new Map<string, ManagedClient>();

  constructor() {
    mkdirSync(SESSION_DATA_PATH, { recursive: true });
  }

  isRunning(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  runningCount(): number {
    return this.sessions.size;
  }

  async start(identity: SessionIdentity, events: WhatsAppServiceEvents): Promise<void> {
    const { sessionId } = identity;
    if (this.sessions.has(sessionId)) {
      console.log(`[whatsAppWebJsProvider] session ${sessionId} already running, ignoring duplicate start`);
      return;
    }

    const encryptionKey = await resolveSessionEncryptionKey(sessionId);
    const store = new SupabaseStorageStore(sessionId, encryptionKey);

    const client = new Client({
      authStrategy: new RemoteAuth({
        clientId: sessionId,
        store,
        backupSyncIntervalMs: 60_000, // RemoteAuth's own enforced minimum
        dataPath: SESSION_DATA_PATH,
      }),
      // WhatsApp's own web client version drifts frequently; whatsapp-web.js
      // ships a bundled/cached version to inject that can go stale and
      // cause the page to reload mid-injection ("Execution context was
      // destroyed" — a widely-reported community issue, not specific to
      // this setup). `type: 'none'` skips the stale local cache and lets
      // the library negotiate whatever version WhatsApp serves live.
      webVersionCache: { type: "none" },
      puppeteer: {
        // Portable across any future host (Railway/Fly/a VPS) without
        // depending on `docker run --cap-add=SYS_ADMIN`, which a deployer
        // can't be guaranteed to set — see worker README.
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    });

    this.sessions.set(sessionId, { client, identity });

    client.on("qr", async (qr) => {
      try {
        const dataUrl = await QRCode.toDataURL(qr);
        await events.onQr({ dataUrl });
      } catch (err) {
        console.error(`[whatsAppWebJsProvider] failed to encode QR for session ${sessionId}:`, err);
      }
    });

    client.on("ready", async () => {
      const wid = client.info?.wid?.user;
      await events.onReady({
        phoneE164: wid ? `+${wid}` : null,
        deviceName: client.info?.pushname ?? null,
      });
    });

    client.on("disconnected", async (reason: string) => {
      this.sessions.delete(sessionId);
      await events.onDisconnected(reason === "LOGOUT" ? { kind: "logged_out" } : { kind: "recoverable", reason });
    });

    client.on("message", async (msg) => {
      if (msg.fromMe) return; // 'message' already excludes fromMe, but stay defensive

      // Group/channel/status messages must never reach the CRM Inbox
      // (explicit product decision). `chat.isGroup` is WhatsApp's own
      // authoritative flag for groups — fail OPEN (let the message through)
      // if the chat can't be resolved, since silently dropping a real
      // lead's message is worse than occasionally letting one slip in.
      // Channels/newsletters use a `Channel`-typed chat (a separate
      // interface from `Chat` in this library version, no `isChannel` on
      // the type `getChat()` returns here) — the `@newsletter` domain check
      // below covers those instead.
      try {
        const chat = await msg.getChat();
        if (chat.isGroup) return;
      } catch (err) {
        console.warn("[whatsAppWebJsProvider] could not resolve chat.isGroup, letting the message through:", err);
      }
      if (msg.isStatus || msg.broadcast) return;
      if (msg.from.endsWith("@newsletter") || msg.from.endsWith("@broadcast")) return;

      // The raw WhatsApp chat id is ALWAYS available and ALWAYS stable —
      // this, not any derived "phone number", is the real identity of a
      // WhatsApp Web conversation (see 0086_whatsapp_web_chat_id.sql).
      // `msg.author` is only set for group messages (already filtered out
      // above), so `msg.from` is the correct 1:1 chat id here.
      const chatId = msg.from;
      // Only a @c.us-addressed chat corresponds to a real, dialable phone
      // number. WhatsApp's "LID" (Linked ID) number-privacy addressing
      // (@lid) has no phone number attached at all — treating its raw
      // digits as if they were a phone number is exactly the bug this
      // fixes. `phone` is now either a REAL E.164 number or null, never an
      // internal identifier.
      const phone = chatId.endsWith("@c.us") ? `+${chatId.split("@")[0]}` : null;

      const wid = client.info?.wid?.user;
      let profileName: string | null = null;
      try {
        const contact = await msg.getContact();
        profileName = contact?.pushname ?? null;
      } catch {
        // best-effort only — never block ingestion on this
      }
      let avatarUrl: string | null = null;
      try {
        avatarUrl = await client.getProfilePicUrl(chatId);
      } catch {
        // No profile picture, or the contact's privacy settings hide it —
        // not an error, just means no avatar to show.
      }

      await events.onInboundMessage({
        chatId,
        fromPhone: phone,
        businessNumber: wid ? `+${wid}` : "",
        profileName,
        avatarUrl,
        body: msg.body,
        externalId: msg.id._serialized,
      });
    });

    client.on("message_ack", async (msg, ack) => {
      const status = mapAck(ack);
      if (!status) return;
      await events.onMessageAck({ externalId: msg.id._serialized, status });
    });

    client.on("remote_session_saved", () => {
      console.log(`[whatsAppWebJsProvider] periodic session backup confirmed for ${sessionId}`);
    });

    await client.initialize();
  }

  /** Real logout — invalidates the remote session and wipes the Storage
   * blob (client.logout() → RemoteAuth.logout() → store.delete()). */
  async logout(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (managed) {
      try {
        await managed.client.logout();
      } catch (err) {
        console.warn(`[whatsAppWebJsProvider] logout() threw for session ${sessionId}, tearing down anyway:`, err);
        await managed.client.destroy().catch(() => {});
      }
      this.sessions.delete(sessionId);
      return;
    }

    // Not running in this process (e.g. after a redeploy) — still need the
    // Storage blob gone. RemoteAuth's own logout() needs a live Client, so
    // delete the blob directly via the same Store shape.
    const encryptionKey = await resolveSessionEncryptionKey(sessionId).catch(() => null);
    if (encryptionKey) {
      await new SupabaseStorageStore(sessionId, encryptionKey).delete({ session: sessionId }).catch(() => {});
    }
  }

  /** Tears down the Chromium process WITHOUT invalidating the remote
   * session — for backoff reconnects and graceful shutdown. */
  async stop(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;
    this.sessions.delete(sessionId);
    await managed.client.destroy().catch((err) => {
      console.warn(`[whatsAppWebJsProvider] destroy() threw for session ${sessionId}:`, err);
    });
  }

  /** `to` is either a raw WhatsApp chat id (contains "@" — the normal case,
   * the exact id an inbound message from this same chat already gave us, see
   * `whatsapp_web_chat_id`) or a bare E.164 phone number (starts with "+",
   * no "@" — only for outbound-first conversations with no prior inbound
   * message, e.g. a lead created directly in the CRM). Sending straight to
   * an already-known chat id needs no phone-to-JID resolution AT ALL, which
   * is what makes this reliable for replies — getNumberId() is only ever
   * reached for the outbound-first case. */
  async sendText(sessionId: string, to: string, body: string): Promise<{ externalId?: string }> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`session ${sessionId} has no active client in this process`);

    // TEMP DEBUG — remove once the send path is confirmed stable in
    // production (requested to verify exactly where the flow breaks).
    console.log(`[whatsAppWebJsProvider] sendText destination received: "${to}"`);

    const chatId = to.includes("@") ? to : null;
    if (chatId) {
      console.log(`[whatsAppWebJsProvider] sending directly to known chatId="${chatId}"`);
      const result = await managed.client.sendMessage(chatId, body);
      return { externalId: result?.id?._serialized };
    }

    const digits = to.replace(/[^0-9]/g, "");
    const jid = `${digits}@c.us`;
    console.log(`[whatsAppWebJsProvider] no chatId known — phoneNumber="${to}" digits="${digits}" jid="${jid}"`);
    try {
      const result = await managed.client.sendMessage(jid, body);
      return { externalId: result?.id?._serialized };
    } catch (directErr) {
      console.log(`[whatsAppWebJsProvider] direct send to jid="${jid}" failed, falling back to getNumberId(digits="${digits}")`);
      const numberId = await managed.client.getNumberId(digits).catch((err) => {
        console.log("[whatsAppWebJsProvider] getNumberId threw:", err);
        return null;
      });
      console.log("[whatsAppWebJsProvider] getNumberId result:", numberId);
      if (!numberId) throw directErr;
      const result = await managed.client.sendMessage(numberId._serialized, body);
      return { externalId: result?.id?._serialized };
    }
  }

  async shutdownAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    await Promise.allSettled(ids.map((id) => this.stop(id)));
  }
}
