"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { logActivity } from "@/lib/activity/log";
import { importPolicyRows, type PolicyImportResult } from "@/lib/policies/import";
import {
  getInsuranceProvidersBoard,
  summarizeInsuranceProviders,
  getInsuranceSyncJobs,
  type InsuranceProviderCard,
  type InsuranceProvidersSummary,
  type InsuranceSyncJobEntry,
} from "@/lib/insuranceProviders/queries";

function revalidateInsuranceProviders() {
  revalidatePath("/aseguradoras");
}

export interface InsuranceProvidersBoardResult {
  providers: InsuranceProviderCard[];
  summary: InsuranceProvidersSummary;
}

export async function getInsuranceProvidersBoardAction(): Promise<InsuranceProvidersBoardResult> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_providers");
  const providers = await getInsuranceProvidersBoard(workspaceId);
  return { providers, summary: summarizeInsuranceProviders(providers) };
}

export interface InsuranceConnectionDetail {
  provider: InsuranceProviderCard;
  jobs: InsuranceSyncJobEntry[];
}

/** Panel "Administrar conexión" — tarjeta del proveedor + su historial de
 * sincronizaciones. providerId, no connectionId: todavía es válido pedir el
 * detalle de un proveedor sin conexión creada (status "not_connected"). */
export async function getInsuranceConnectionDetailAction(providerId: string): Promise<InsuranceConnectionDetail | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_providers");
  const providers = await getInsuranceProvidersBoard(workspaceId);
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) return { error: "Aseguradora no encontrada." };

  const jobs = provider.connectionId ? await getInsuranceSyncJobs(workspaceId, provider.connectionId) : [];
  return { provider, jobs };
}

export async function disconnectInsuranceProviderAction(connectionId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: connection } = await supabase.from("insurance_connections").select("provider_id").eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!connection) throw new Error("Conexión no encontrada.");

  const { error } = await supabase
    .from("insurance_connections")
    .update({ status: "not_connected", method: null, connected_at: null, updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo desconectar la aseguradora.");

  await logActivity(supabase, workspaceId, memberId, "insurance_connection", connectionId, "insurance_connection_disconnected", {});
  revalidateInsuranceProviders();
}

// ---------------------------------------------------------------------------
// Carga manual — único método real hoy. Reusa parsePolicyImportFileAction /
// parsePolicyImportSheetAction (src/lib/policies/actions.ts) sin cambios
// para el paso de leer el archivo; este confirm es propio (no
// confirmPolicyImportAction) porque además de crear las pólizas necesita
// estampar insuranceConnectionId, dejar un insurance_sync_jobs y actualizar
// insurance_connections — confirmPolicyImportAction no sabe nada de eso.
// ---------------------------------------------------------------------------

export interface InsuranceManualSyncResult extends PolicyImportResult {
  connectionId: string;
}

export async function confirmInsuranceManualSyncAction(
  providerId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  fileName: string,
): Promise<InsuranceManualSyncResult | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_providers");
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: provider } = await supabase.from("insurance_providers").select("id, name").eq("id", providerId).maybeSingle();
  if (!provider) return { error: "Aseguradora no encontrada." };

  const { data: existingConnection } = await supabase
    .from("insurance_connections")
    .select("id, connected_at")
    .eq("workspace_id", workspaceId)
    .eq("provider_id", providerId)
    .maybeSingle();

  let connectionId = existingConnection?.id as string | undefined;
  if (!connectionId) {
    const { data: created, error: createError } = await supabase
      .from("insurance_connections")
      .insert({ workspace_id: workspaceId, provider_id: providerId, status: "connected", method: "manual", connected_by: memberId, connected_at: new Date().toISOString() })
      .select("id")
      .single();
    if (createError || !created) return { error: "No se pudo crear la conexión con la aseguradora." };
    connectionId = created.id as string;
  }

  const { data: job, error: jobError } = await supabase
    .from("insurance_sync_jobs")
    .insert({ connection_id: connectionId, workspace_id: workspaceId, status: "processing", triggered_by: memberId, source_file_name: fileName })
    .select("id")
    .single();
  if (jobError || !job) return { error: "No se pudo iniciar la sincronización." };

  const result = await importPolicyRows(workspaceId, memberId, rows, mapping, memberId, connectionId);

  const jobStatus = result.created === 0 && result.errors.length > 0 ? "failed" : "completed";
  const { data: distinctContacts } = await supabase.from("policies").select("contact_id").eq("insurance_connection_id", connectionId);
  const clientsSyncedCount = new Set(((distinctContacts ?? []) as { contact_id: string }[]).map((r) => r.contact_id)).size;

  await supabase
    .from("insurance_sync_jobs")
    .update({
      status: jobStatus,
      policies_synced_count: result.created,
      clients_synced_count: clientsSyncedCount,
      error: jobStatus === "failed" ? (result.errors[0]?.message ?? "No se pudo sincronizar ninguna fila.") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id as string);

  await supabase
    .from("insurance_connections")
    .update({
      status: "connected",
      method: "manual",
      connected_by: memberId,
      connected_at: existingConnection?.connected_at ?? new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      last_error: jobStatus === "failed" ? (result.errors[0]?.message ?? null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  await logActivity(supabase, workspaceId, memberId, "insurance_connection", connectionId, "insurance_connection_synced", {
    provider: provider.name,
    created: result.created,
    errors: result.errors.length,
  });

  revalidateInsuranceProviders();
  return { ...result, connectionId };
}
