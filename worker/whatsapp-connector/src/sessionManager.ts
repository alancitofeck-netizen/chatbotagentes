import makeWASocket, { makeCacheableSignalKeyStore, fetchLatestBaileysVersion, type WASocket } from "@whiskeysockets/baileys";
import pino from "pino";
import { loadAuthState } from "./authStore.js";
import { registerSessionEvents } from "./events.js";
import { supabase } from "./supabase.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

interface ManagedSession {
  sock: WASocket;
  workspaceId: string;
  memberId: string;
}

/** One entry per (workspace, member) session — NEVER a shared/global socket,
 * so hundreds of workspaces' sessions stay fully independent in this single
 * process (per the user's explicit "no variables globales que mezclen
 * sesiones" requirement). */
const sessions = new Map<string, ManagedSession>();
const reconnectAttempts = new Map<string, number>();

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Starts (or resumes) a session. Whether this results in a fresh QR or a
 * silent resume is entirely determined by what `loadAuthState` finds in
 * `whatsapp_web_credentials` — no separate branch needed here:
 * `provision_whatsapp_web_session` already deleted any stale credentials on
 * a real logout, so a brand-new/just-logged-out session naturally has none
 * (Baileys generates a QR), while a merely-`disconnected` one still has its
 * creds (Baileys resumes silently).
 */
export async function startSession(sessionId: string, workspaceId: string, memberId: string): Promise<void> {
  if (sessions.has(sessionId)) {
    logger.info({ sessionId }, "session already running, ignoring duplicate start");
    return;
  }

  const { state, saveCreds } = await loadAuthState(sessionId, workspaceId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    browser: ["Growth Link", "Chrome", "1.0.0"],
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
  });

  sessions.set(sessionId, { sock, workspaceId, memberId });

  sock.ev.on("creds.update", saveCreds);
  registerSessionEvents(
    sock,
    { sessionId, workspaceId, memberId },
    {
      onRecoverableClose: () => scheduleReconnect(sessionId, workspaceId, memberId),
      onLoggedOut: () => {
        sessions.delete(sessionId);
        reconnectAttempts.delete(sessionId);
      },
    },
  );
}

function scheduleReconnect(sessionId: string, workspaceId: string, memberId: string): void {
  sessions.delete(sessionId); // the old socket is dead either way

  const attempt = (reconnectAttempts.get(sessionId) ?? 0) + 1;
  reconnectAttempts.set(sessionId, attempt);

  if (attempt > MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts.delete(sessionId);
    void markDisconnected(sessionId);
    return;
  }

  const jitter = 0.8 + Math.random() * 0.4; // 0.8x-1.2x
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS) * jitter;
  logger.warn({ sessionId, attempt, delay: Math.round(delay) }, "recoverable disconnect — scheduling reconnect");

  setTimeout(() => {
    startSession(sessionId, workspaceId, memberId).catch((err) => {
      logger.error({ sessionId, err }, "reconnect attempt threw — scheduling another");
      scheduleReconnect(sessionId, workspaceId, memberId);
    });
  }, delay);
}

/** Retries exhausted — surface this as a status a human can act on
 * ("Reconectar" in the UI) instead of retrying forever in the background. */
async function markDisconnected(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_web_sessions")
    .update({
      status: "disconnected",
      last_disconnected_at: new Date().toISOString(),
      disconnect_reason: "connection_lost",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) logger.error({ sessionId, error }, "failed to mark session disconnected after exhausting retries");
}

/** A real logout (unlink) — never auto-retried. Idempotent: safe to call
 * even if the socket already isn't running in this process. */
export async function logoutSession(sessionId: string): Promise<void> {
  const managed = sessions.get(sessionId);
  reconnectAttempts.delete(sessionId);

  if (managed) {
    try {
      await managed.sock.logout();
    } catch (err) {
      logger.warn({ sessionId, err }, "sock.logout() threw — tearing down the socket anyway");
    }
    sessions.delete(sessionId);
  }

  // logout() triggers Baileys' own DisconnectReason.loggedOut close, already
  // handled by events.ts's onLoggedOut — this covers the case where the
  // socket wasn't running in this process at all (e.g. after a redeploy).
  const { error } = await supabase
    .from("whatsapp_web_sessions")
    .update({
      status: "logged_out",
      last_disconnected_at: new Date().toISOString(),
      disconnect_reason: "logged_out",
      qr_data: null,
      qr_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) logger.error({ sessionId, error }, "failed to record logout");
}

export async function sendTextMessage(sessionId: string, to: string, body: string): Promise<{ ok: boolean; externalId?: string }> {
  const managed = sessions.get(sessionId);
  if (!managed) throw new Error(`session ${sessionId} has no active socket in this process`);

  const digits = to.replace(/[^0-9]/g, "");
  const jid = `${digits}@s.whatsapp.net`;
  const result = await managed.sock.sendMessage(jid, { text: body });
  return { ok: true, externalId: result?.key.id ?? undefined };
}

/** Called once at boot — a worker redeploy/restart must not force every
 * connected member to re-scan a QR (explicit requirement). */
export async function resumeAllActiveSessions(): Promise<void> {
  const { data, error } = await supabase
    .from("whatsapp_web_sessions")
    .select("id, workspace_id, member_id")
    .in("status", ["connected", "connecting", "qr_pending"]);
  if (error) {
    logger.error({ error }, "failed to list sessions to resume at boot");
    return;
  }

  for (const row of data ?? []) {
    startSession(row.id as string, row.workspace_id as string, row.member_id as string).catch((err) =>
      logger.error({ sessionId: row.id, err }, "failed to resume session at boot"),
    );
  }
  logger.info({ count: data?.length ?? 0 }, "resumed sessions at boot");
}
