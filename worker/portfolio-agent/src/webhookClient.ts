import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { PortalPolicyRaw } from "./portalAdapter.js";

/** Reporta progreso/resultados a Growth Link — mismo patrón que
 * `src/lib/whatsappWeb/messages.ts`'s `postToWebhook()` en el worker de
 * WhatsApp Web: sin retry (solo loguea si falla), cada evento con un
 * eventId propio para que el receptor haga idempotencia vía `webhook_events`
 * (provider: "portfolio_agent"). El worker nunca escribe directo a
 * Supabase salvo para leer credenciales/cancel_requested — todo el resto
 * (estado del job, upsert de pólizas, matching de contacto) lo hace Growth
 * Link al recibir estos eventos, con el resto de su propia lógica de
 * negocio (findOrCreateContact, RLS, etc.) intacta. */
async function postToWebhook(body: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${config.nextAppUrl.replace(/\/$/, "")}/api/webhooks/portfolio-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.webhookSecret}` },
      body: JSON.stringify({ eventId: randomUUID(), ...body }),
    });
    if (!res.ok) {
      console.error("[webhookClient] Growth Link rejected event:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[webhookClient] failed to reach Growth Link:", err);
  }
}

interface JobRef {
  jobId: string;
  workspaceId: string;
  connectionId: string;
}

export async function postProgress(ref: JobRef, step: string, processed: number, total: number | null): Promise<void> {
  await postToWebhook({ ...ref, type: "progress", progress: { step, processed, total } });
}

export async function postPolicyExtracted(ref: JobRef, policy: PortalPolicyRaw): Promise<void> {
  await postToWebhook({ ...ref, type: "policy_extracted", policy });
}

export async function postCompleted(ref: JobRef, processedCount: number): Promise<void> {
  await postToWebhook({ ...ref, type: "completed", processedCount });
}

export async function postFailed(ref: JobRef, error: string): Promise<void> {
  await postToWebhook({ ...ref, type: "failed", error });
}

export async function postCancelled(ref: JobRef, processedCount: number): Promise<void> {
  await postToWebhook({ ...ref, type: "cancelled", processedCount });
}

export async function postRequiresUserAction(ref: JobRef, reason: string): Promise<void> {
  await postToWebhook({ ...ref, type: "requires_user_action", reason });
}
