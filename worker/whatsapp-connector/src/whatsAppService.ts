/**
 * The one file every other module in this worker depends on for WhatsApp
 * session behavior — deliberately free of any import from a specific
 * WhatsApp library (whatsapp-web.js, Baileys, or a future Meta Cloud API
 * client). `sessionManager.ts` (orchestration: session map, reconnect
 * backoff) and `controlApi.ts` (HTTP routes) only ever see these types.
 *
 * Swapping the underlying library later means writing a new class that
 * implements `WhatsAppService` (e.g. `providers/baileysProvider.ts`) and
 * changing the single line in `index.ts` that decides which one gets
 * instantiated — nothing else in this worker, and nothing in the Next.js
 * app (which only ever talks to this worker over HTTP), needs to change.
 */

export interface SessionIdentity {
  sessionId: string;
  workspaceId: string;
  memberId: string;
}

/** A real, user-initiated logout (via the phone) is terminal — never
 * auto-retried, requires a fresh QR next time. Anything else (network drop,
 * navigation hiccup, container restart mid-session) is recoverable — the
 * caller should reconnect with backoff using the same persisted session. */
export type DisconnectKind = { kind: "logged_out" } | { kind: "recoverable"; reason: string };

export interface WhatsAppServiceEvents {
  onQr(qr: { dataUrl: string }): void | Promise<void>;
  onReady(info: { phoneE164: string | null; deviceName: string | null }): void | Promise<void>;
  onDisconnected(reason: DisconnectKind): void | Promise<void>;
  onInboundMessage(msg: {
    fromPhone: string;
    businessNumber: string;
    profileName: string | null;
    body: string;
    externalId: string;
  }): void | Promise<void>;
  onMessageAck(ack: { externalId: string; status: string }): void | Promise<void>;
}

export interface WhatsAppService {
  /** Begins connecting/resuming this session. Resolves once initialization
   * has started — actual qr/ready/disconnected/message events arrive later
   * via the `events` callbacks. */
  start(identity: SessionIdentity, events: WhatsAppServiceEvents): Promise<void>;
  /** Real logout: invalidates the remote WhatsApp session AND wipes this
   * session's persisted store entry. Idempotent — safe even if this session
   * isn't running in this process at all. */
  logout(sessionId: string): Promise<void>;
  /** Tears down local resources for this session WITHOUT invalidating the
   * remote WhatsApp session — used before a backoff reconnect, or during a
   * graceful process shutdown. Idempotent. */
  stop(sessionId: string): Promise<void>;
  isRunning(sessionId: string): boolean;
  /** Total number of sessions currently running in this process — used to
   * enforce `WHATSAPP_WEB_MAX_SESSIONS` before starting a new one. */
  runningCount(): number;
  sendText(sessionId: string, to: string, body: string): Promise<{ externalId?: string }>;
  /** Graceful process-shutdown hook (SIGTERM/SIGINT) — stop() every running
   * session so no orphaned Chromium processes survive the container. */
  shutdownAll(): Promise<void>;
}
