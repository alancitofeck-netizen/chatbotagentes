"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { logActivity } from "@/lib/activity/log";
import { startWorkerJob, cancelWorkerJob } from "./workerClient";

function revalidatePortfolioAgent() {
  revalidatePath("/aseguradoras");
  revalidatePath("/analizador-cartera");
}

export type SavePortalCredentialsResult = { ok: true; connectionId: string } | { ok: false; error: string };

/** Guarda usuario/contraseña del portal para una aseguradora — nunca en
 * texto plano en una tabla normal: pasa por `upsert_portal_credentials`
 * (0162_portfolio_agent.sql), que las guarda como un secreto de Supabase
 * Vault, mismo patrón que Google Calendar (0018). Asegura primero la fila
 * de `insurance_connections` (creándola si hace falta), igual que
 * `confirmInsuranceManualSyncAction` ya hace para el método manual. */
export async function savePortalCredentialsAction(providerId: string, portalUrl: string, username: string, password: string): Promise<SavePortalCredentialsResult> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_providers");
  const supabase = await createClient();

  const { data: provider } = await supabase.from("insurance_providers").select("id, name, portal_domain").eq("id", providerId).maybeSingle();
  if (!provider) return { ok: false, error: "Aseguradora no encontrada." };
  if (!provider.portal_domain) return { ok: false, error: `Todavía no habilitamos la conexión por portal para ${provider.name}.` };

  if (!username.trim() || !password) return { ok: false, error: "Usuario y contraseña son obligatorios." };

  let hostname: string;
  try {
    hostname = new URL(portalUrl).hostname;
  } catch {
    return { ok: false, error: "La URL del portal no es válida." };
  }
  const allowedDomain = provider.portal_domain as string;
  if (hostname !== allowedDomain && !hostname.endsWith(`.${allowedDomain}`)) {
    return { ok: false, error: `La URL tiene que ser del dominio ${allowedDomain}.` };
  }

  const { data: existingConnection } = await supabase.from("insurance_connections").select("id").eq("workspace_id", workspaceId).eq("provider_id", providerId).maybeSingle();

  let connectionId = existingConnection?.id as string | undefined;
  if (!connectionId) {
    const { data: created, error: createError } = await supabase
      .from("insurance_connections")
      .insert({ workspace_id: workspaceId, provider_id: providerId, status: "not_connected", method: "portal" })
      .select("id")
      .single();
    if (createError || !created) return { ok: false, error: "No se pudo crear la conexión con la aseguradora." };
    connectionId = created.id as string;
  } else {
    await supabase.from("insurance_connections").update({ method: "portal", updated_at: new Date().toISOString() }).eq("id", connectionId);
  }

  const { error: vaultError } = await supabase.rpc("upsert_portal_credentials", {
    p_connection_id: connectionId,
    p_secret_json: JSON.stringify({ username: username.trim(), password, portalUrl }),
  });
  if (vaultError) {
    console.error("[portfolioAgent] upsert_portal_credentials failed:", vaultError);
    return { ok: false, error: "No se pudieron guardar las credenciales de forma segura." };
  }

  const memberId = await getCurrentMemberId(workspaceId);
  await logActivity(supabase, workspaceId, memberId, "insurance_connection", connectionId, "insurance_connection_portal_credentials_saved", { provider: provider.name });
  revalidatePortfolioAgent();
  return { ok: true, connectionId };
}

export type StartPortalSyncResult = { ok: true; jobId: string } | { ok: false; error: string };

/** Crea el `insurance_sync_jobs` en 'queued' y dispara el worker — el
 * worker corre el job en background y reporta todo vía webhook, esta
 * Server Action no espera a que termine. */
export async function startPortalSyncAction(connectionId: string): Promise<StartPortalSyncResult> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_providers");
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: connection } = await supabase.from("insurance_connections").select("id, method").eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!connection) return { ok: false, error: "Conexión no encontrada." };
  if (connection.method !== "portal") return { ok: false, error: "Esta conexión no usa sincronización por portal." };

  const { data: job, error: jobError } = await supabase
    .from("insurance_sync_jobs")
    .insert({ connection_id: connectionId, workspace_id: workspaceId, status: "queued", triggered_by: memberId })
    .select("id")
    .single();
  if (jobError || !job) return { ok: false, error: "No se pudo crear el trabajo de sincronización." };
  const jobId = job.id as string;

  try {
    await startWorkerJob(jobId, workspaceId, connectionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo contactar al worker.";
    await supabase.from("insurance_sync_jobs").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", jobId);
    return { ok: false, error: message };
  }

  revalidatePortfolioAgent();
  return { ok: true, jobId };
}

export async function cancelPortalSyncAction(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: job } = await supabase.from("insurance_sync_jobs").select("id").eq("id", jobId).eq("workspace_id", workspaceId).maybeSingle();
  if (!job) return { ok: false, error: "Trabajo no encontrado." };

  try {
    await cancelWorkerJob(jobId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo cancelar la sincronización." };
  }
  revalidatePortfolioAgent();
  return { ok: true };
}
