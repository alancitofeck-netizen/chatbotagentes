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
      // Group messages must never reach the CRM Inbox (explicit product
      // decision). Neither `msg.from.endsWith("@g.us")` nor `msg.author`
      // being set are reliable enough — confirmed in production: WhatsApp's
      // "LID" (Linked ID) number-privacy addressing shows up on BOTH real
      // 1:1 contacts (a person with number-privacy enabled messaging
      // directly — msg.author IS set for these too, even though it's not a
      // group) and actual group messages, so neither heuristic can tell
      // them apart. `chat.isGroup` is WhatsApp's own authoritative flag —
      // fail OPEN (let the message through) if it can't be determined,
      // since silently dropping a real lead's message is worse than
      // occasionally letting a group message slip in.
      try {
        const chat = await msg.getChat();
        if (chat.isGroup) return;
      } catch (err) {
        console.warn("[whatsAppWebJsProvider] could not resolve chat.isGroup, letting the message through:", err);
      }
      const wid = client.info?.wid?.user;
      let profileName: string | null = null;
      try {
        const contact = await msg.getContact();
        profileName = contact?.pushname ?? null;
      } catch {
        // best-effort only — never block ingestion on this
      }
      await events.onInboundMessage({
        fromPhone: `+${msg.from.split("@")[0]}`,
        businessNumber: wid ? `+${wid}` : "",
        profileName,
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

  async sendText(sessionId: string, to: string, body: string): Promise<{ externalId?: string }> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error(`session ${sessionId} has no active client in this process`);
    const digits = to.replace(/[^0-9]/g, "");
    // Hand-building `${digits}@c.us` and sending straight to it throws
    // "No LID for user" inside the page — WhatsApp's client-side code needs
    // the number resolved through its own contact-lookup first (this is
    // what populates the LID mapping the newer multi-device protocol needs),
    // which a locally-constructed JID skips entirely. getNumberId() does
    // that resolution server-side and returns the canonical id to send to,
    // or null if the number isn't a registered WhatsApp account at all —
    // confirmed via a real send failure in production (see git history),
    // not a shot in the dark.
    const numberId = await managed.client.getNumberId(digits);
    if (!numberId) throw new Error(`${to} is not a registered WhatsApp number`);
    const result = await managed.client.sendMessage(numberId._serialized, body);
    return { externalId: result?.id?._serialized };
  }

  async shutdownAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    await Promise.allSettled(ids.map((id) => this.stop(id)));
  }
}
