import pino from "pino";
import { supabase } from "./supabase.js";
import { config } from "./config.js";
import type { WhatsAppService } from "./whatsAppService.js";
import { forwardInboundMessage, forwardStatusUpdate } from "./messages.js";

const logger = pino({ level: config.logLevel });

/**
 * Pure orchestration — session bookkeeping, reconnect backoff — with zero
 * knowledge of whatsapp-web.js or any other specific library. Depends only
 * on the injected `WhatsAppService` (whatsAppService.ts). Swapping providers
 * later means changing what gets passed to `initSessionManager` in
 * index.ts, not this file.
 */

let service: WhatsAppService;
const reconnectAttempts = new Map<string, number>();

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

export function initSessionManager(whatsAppService: WhatsAppService): void {
  service = whatsAppService;
}

async function updateSessionRow(sessionId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_web_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) console.error(`[sessionManager] failed to update whatsapp_web_sessions ${sessionId}:`, error);
}

/**
 * Starts (or resumes) a session. Whether this results in a fresh QR or a
 * silent resume is entirely determined by what's already persisted in
 * Storage for this session (nothing to branch on here) —
 * `provision_whatsapp_web_session` already wiped any stale blob on a real
 * logout, so a brand-new/just-logged-out session naturally has none.
 */
export async function startSession(sessionId: string, workspaceId: string, memberId: string): Promise<void> {
  if (service.isRunning(sessionId)) {
    logger.info({ sessionId }, "session already running, ignoring duplicate start");
    return;
  }

  const runningCount = service.runningCount();
  if (runningCount >= config.maxConcurrentSessions) {
    throw new Error(
      `max_concurrent_sessions_reached: this worker already runs ${runningCount}/${config.maxConcurrentSessions} sessions`,
    );
  }

  await service.start(
    { sessionId, workspaceId, memberId },
    {
      onQr: async ({ dataUrl }) => {
        await updateSessionRow(sessionId, {
          status: "qr_pending",
          qr_data: dataUrl,
          qr_expires_at: new Date(Date.now() + 60_000).toISOString(),
        });
      },
      onReady: async ({ phoneE164, deviceName }) => {
        reconnectAttempts.delete(sessionId);
        await updateSessionRow(sessionId, {
          status: "connected",
          phone_e164: phoneE164,
          device_name: deviceName,
          qr_data: null,
          qr_expires_at: null,
          last_connected_at: new Date().toISOString(),
          disconnect_reason: null,
        });
      },
      onDisconnected: async (reason) => {
        if (reason.kind === "logged_out") {
          reconnectAttempts.delete(sessionId);
          await service.logout(sessionId); // idempotent — makes sure the Storage blob is gone even if already torn down
          await updateSessionRow(sessionId, {
            status: "logged_out",
            last_disconnected_at: new Date().toISOString(),
            disconnect_reason: "logged_out",
            qr_data: null,
            qr_expires_at: null,
          });
          return;
        }
        scheduleReconnect(sessionId, workspaceId, memberId, reason.reason);
      },
      onAuthFailure: async (message) => {
        reconnectAttempts.delete(sessionId);
        // Nunca se reintenta solo (mismo criterio que logged_out) — la
        // sesión Storage/Vault vieja ya no es confiable, provision_whatsapp_web_session
        // la reemplaza por completo la próxima vez que el usuario haga clic
        // en "Reintentar" (ver 0159_whatsapp_web_auth_failed_status.sql).
        await service.stop(sessionId).catch(() => {});
        await updateSessionRow(sessionId, {
          status: "auth_failed",
          last_disconnected_at: new Date().toISOString(),
          disconnect_reason: message,
          qr_data: null,
          qr_expires_at: null,
        });
      },
      onInboundMessage: async (msg) => {
        await forwardInboundMessage({ sessionId, workspaceId, memberId }, msg);
      },
      onMessageAck: async (ack) => {
        await forwardStatusUpdate({ sessionId, workspaceId, memberId }, ack);
      },
    },
  );
}

function scheduleReconnect(sessionId: string, workspaceId: string, memberId: string, reason: string): void {
  const attempt = (reconnectAttempts.get(sessionId) ?? 0) + 1;
  reconnectAttempts.set(sessionId, attempt);

  if (attempt > MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts.delete(sessionId);
    void service.stop(sessionId);
    void markDisconnected(sessionId);
    return;
  }

  const jitter = 0.8 + Math.random() * 0.4; // 0.8x-1.2x
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS) * jitter;
  logger.warn({ sessionId, attempt, reason, delay: Math.round(delay) }, "recoverable disconnect — scheduling reconnect");

  setTimeout(() => {
    service
      .stop(sessionId)
      .then(() => startSession(sessionId, workspaceId, memberId))
      .catch((err) => {
        logger.error({ sessionId, err }, "reconnect attempt threw — scheduling another");
        scheduleReconnect(sessionId, workspaceId, memberId, "reconnect_attempt_failed");
      });
  }, delay);
}

async function markDisconnected(sessionId: string): Promise<void> {
  await updateSessionRow(sessionId, {
    status: "disconnected",
    last_disconnected_at: new Date().toISOString(),
    disconnect_reason: "connection_lost",
  });
}

export async function logoutSession(sessionId: string): Promise<void> {
  reconnectAttempts.delete(sessionId);
  await service.logout(sessionId);
  await updateSessionRow(sessionId, {
    status: "logged_out",
    last_disconnected_at: new Date().toISOString(),
    disconnect_reason: "logged_out",
    qr_data: null,
    qr_expires_at: null,
  });
}

export async function sendTextMessage(sessionId: string, to: string, body: string): Promise<{ ok: boolean; externalId?: string }> {
  const result = await service.sendText(sessionId, to, body);
  return { ok: true, externalId: result.externalId };
}

/** Called once at boot — a worker redeploy/restart must not force every
 * connected member to re-scan a QR (explicit requirement). Staggered
 * (small batches, short delay between them) rather than firing every
 * session's startSession concurrently — each start now launches a real
 * Chromium process, so an unstaggered boot with many connected sessions
 * would be a thundering herd of simultaneous browser launches. */
export async function resumeAllActiveSessions(): Promise<void> {
  const { data, error } = await supabase
    .from("whatsapp_web_sessions")
    .select("id, workspace_id, member_id")
    .in("status", ["connected", "connecting", "qr_pending"]);
  if (error) {
    logger.error({ error }, "failed to list sessions to resume at boot");
    return;
  }

  const rows = data ?? [];
  const BATCH_SIZE = 2;
  const BATCH_DELAY_MS = 5_000;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map((row) =>
        startSession(row.id as string, row.workspace_id as string, row.member_id as string).catch((err) =>
          logger.error({ sessionId: row.id, err }, "failed to resume session at boot"),
        ),
      ),
    );
    if (i + BATCH_SIZE < rows.length) await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }
  logger.info({ count: rows.length }, "resumed sessions at boot");
}

export async function shutdownAll(): Promise<void> {
  await service.shutdownAll();
}
