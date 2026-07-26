import "server-only";

/**
 * Thin HTTP client for the standalone WhatsApp Web worker
 * (`worker/whatsapp-connector/`) — a persistent Node process this Next.js
 * app (serverless, no long-lived connections) cannot host itself. Every call
 * is authenticated with a shared secret, mirroring the CRON_SECRET pattern
 * already used by `src/app/api/cron/*`. Short timeout since these calls sit
 * on a Server Action's / send path's critical path — the worker being slow
 * or down must fail fast, not hang the caller.
 */
const WORKER_TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured — the WhatsApp Web worker is not reachable.`);
  return value;
}

async function callWorker<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = requireEnv("WHATSAPP_WEB_WORKER_URL");
  const secret = requireEnv("WHATSAPP_WEB_WORKER_SECRET");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`[whatsapp-web-worker] ${path} rejected:`, res.status, data);
      throw new Error((data?.error as string | undefined) ?? "El worker de WhatsApp Web rechazó la solicitud.");
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Starts (or resumes) a session — the worker itself writes qr_data/status
 * transitions to `whatsapp_web_sessions` as the socket connects. */
export async function startWorkerSession(sessionId: string, workspaceId: string, memberId: string, resume: boolean): Promise<void> {
  await callWorker(`/sessions/${sessionId}/start`, { workspaceId, memberId, resume });
}

/** Real logout (not just "disconnect") — the worker tears down the socket,
 * marks the session `logged_out`, and the credentials get wiped by
 * `provision_whatsapp_web_session` the next time someone reconnects. */
export async function logoutWorkerSession(sessionId: string): Promise<void> {
  await callWorker(`/sessions/${sessionId}/logout`, {});
}

export interface WorkerSendResult {
  ok: boolean;
  externalId?: string;
}

export async function sendViaWorker(sessionId: string, to: string, body: string): Promise<WorkerSendResult> {
  return callWorker<WorkerSendResult>(`/sessions/${sessionId}/send`, { to, body });
}
