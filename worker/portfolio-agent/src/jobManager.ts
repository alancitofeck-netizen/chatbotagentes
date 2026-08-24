import { supabase } from "./supabase.js";
import { config } from "./config.js";
import { withIsolatedPage } from "./browserManager.js";
import { GenericTestAdapter } from "./adapters/generic/GenericTestAdapter.js";
import { DEFAULT_LIMITS, type PortalAdapter } from "./portalAdapter.js";
import { postProgress, postPolicyExtracted, postCompleted, postFailed, postCancelled, postRequiresUserAction } from "./webhookClient.js";

/** Único adapter de esta pasada — ver GenericTestAdapter.ts. Cuando exista
 * más de uno (fase siguiente, con datos reales de un portal), esta sería la
 * única línea a tocar para elegir el adapter correcto por
 * `insurance_providers.key`. */
const adapter: PortalAdapter = new GenericTestAdapter();

const activeJobs = new Set<string>();

export function runningCount(): number {
  return activeJobs.size;
}

/** Arranca el job en background — el llamador (controlApi) recibe la
 * confirmación de arranque, no espera a que termine (mismo criterio que
 * `sessionManager.startSession` en whatsapp-connector). */
export async function startJob(jobId: string, workspaceId: string, connectionId: string): Promise<void> {
  if (activeJobs.size >= config.maxConcurrentJobs) {
    throw new Error(`max_concurrent_jobs_reached:${config.maxConcurrentJobs}`);
  }
  activeJobs.add(jobId);
  runJob(jobId, workspaceId, connectionId).finally(() => activeJobs.delete(jobId));
}

/** Señal de cancelación — el loop del job la chequea entre cada página
 * (ver runJob). No mata el proceso a la fuerza (pedido sección 24: "no
 * matar procesos abruptamente sin limpiar recursos"), simplemente deja de
 * pedir más páginas y cierra prolijamente. */
export async function cancelJob(jobId: string): Promise<void> {
  await supabase.from("insurance_sync_jobs").update({ cancel_requested: true }).eq("id", jobId);
}

async function isCancelled(jobId: string): Promise<boolean> {
  const { data } = await supabase.from("insurance_sync_jobs").select("cancel_requested").eq("id", jobId).maybeSingle();
  return Boolean(data?.cancel_requested);
}

async function runJob(jobId: string, workspaceId: string, connectionId: string): Promise<void> {
  const ref = { jobId, workspaceId, connectionId };
  await postProgress(ref, "starting", 0, null);

  const { data: credRow, error: credError } = await supabase
    .rpc("get_portal_credentials", { p_connection_id: connectionId })
    .maybeSingle<{ secret_json: string }>();
  if (credError || !credRow?.secret_json) {
    console.error(`[jobManager] job ${jobId}: no se pudieron leer las credenciales:`, credError);
    await postFailed(ref, "No se pudieron leer las credenciales del portal.");
    return;
  }

  let credentials: { username: string; password: string; portalUrl: string };
  try {
    credentials = JSON.parse(credRow.secret_json);
  } catch {
    await postFailed(ref, "Las credenciales guardadas están corruptas — reconectá el portal.");
    return;
  }

  const limits = DEFAULT_LIMITS;

  try {
    await withIsolatedPage(async (page) => {
      const ctx = { page, credentials, limits };

      await postProgress(ref, "authenticating", 0, null);
      const loginResult = await adapter.login(ctx);
      if (!loginResult.ok) {
        if (loginResult.requiresUserAction) {
          await postRequiresUserAction(ref, loginResult.requiresUserAction);
        } else {
          await postFailed(ref, loginResult.error ?? "No se pudo iniciar sesión en el portal.");
        }
        return;
      }

      await postProgress(ref, "navigating", 0, null);
      await adapter.navigateToPolicies(ctx);

      await postProgress(ref, "extracting", 0, null);
      let processed = 0;
      let pageCount = 0;
      let consecutiveErrors = 0;

      while (pageCount < limits.maxPages && processed < limits.maxPolicies) {
        if (await isCancelled(jobId)) {
          await postCancelled(ref, processed);
          return;
        }

        let listRows;
        try {
          listRows = await adapter.getPolicyList(ctx);
          consecutiveErrors = 0;
        } catch (err) {
          consecutiveErrors += 1;
          console.error(`[jobManager] job ${jobId}: error leyendo página ${pageCount + 1} (intento ${consecutiveErrors}):`, err);
          if (consecutiveErrors > limits.maxRetries) {
            await postFailed(ref, `No se pudo leer la página ${pageCount + 1} después de ${limits.maxRetries} reintentos.`);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, limits.delayMs * consecutiveErrors));
          continue;
        }

        for (const row of listRows) {
          if (processed >= limits.maxPolicies) break;
          if (await isCancelled(jobId)) {
            await postCancelled(ref, processed);
            return;
          }
          const detailed = await adapter.getPolicyDetails(ctx, row).catch((err) => {
            console.error(`[jobManager] job ${jobId}: no se pudo leer el detalle de ${row.externalId}:`, err);
            return row;
          });
          await postPolicyExtracted(ref, detailed);
          processed += 1;
          await postProgress(ref, "extracting", processed, null);
          await new Promise((resolve) => setTimeout(resolve, limits.delayMs));
        }

        pageCount += 1;
        const hasNext = await adapter.hasNextPage(ctx).catch(() => false);
        if (!hasNext) break;
        await adapter.nextPage(ctx);
      }

      await postProgress(ref, "syncing", processed, processed);
      await adapter.logout(ctx).catch((err) => console.error(`[jobManager] job ${jobId}: error en logout (no bloqueante):`, err));
      await postCompleted(ref, processed);
    });
  } catch (err) {
    console.error(`[jobManager] job ${jobId} falló:`, err);
    await postFailed(ref, err instanceof Error ? err.message : "Error inesperado durante la sincronización.");
  }
}
