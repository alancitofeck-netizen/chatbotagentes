import "server-only";

/**
 * Thin HTTP client for the standalone Browser Worker
 * (`worker/portfolio-agent/`) — a long-lived Node process this Next.js app
 * (serverless, can't hold a real Chromium session) cannot host itself.
 * Mirrors `src/lib/whatsappWeb/workerClient.ts` exactly: shared-secret
 * bearer auth, short abort timeout since this sits on a Server Action's
 * critical path (the worker being slow/down must fail fast, not hang the
 * caller — the job itself keeps running in the background regardless).
 */
const WORKER_TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está configurado — el worker de Agente IA de Cartera no está disponible.`);
  return value;
}

async function callWorker<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = requireEnv("PORTFOLIO_WORKER_URL");
  const secret = requireEnv("PORTFOLIO_WORKER_SECRET");

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
      console.error(`[portfolio-worker] ${path} rejected:`, res.status, data);
      throw new Error((data?.error as string | undefined) ?? "El worker de Agente IA de Cartera rechazó la solicitud.");
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Dispara el job — el worker lo corre en background y reporta progreso
 * vía webhook (`/api/webhooks/portfolio-agent`), nunca por esta misma
 * llamada. */
export async function startWorkerJob(jobId: string, workspaceId: string, connectionId: string): Promise<void> {
  await callWorker(`/jobs`, { jobId, workspaceId, connectionId });
}

export async function cancelWorkerJob(jobId: string): Promise<void> {
  await callWorker(`/jobs/${jobId}/cancel`, {});
}
