import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionMethod, ConnectionStatus, PortalSyncJobStatus } from "@/lib/insuranceProviders/constants";

export interface InsuranceProviderCard {
  id: string;
  key: string;
  name: string;
  brandColor: string;
  availableMethods: ConnectionMethod[];
  /** Dominio permitido para conectar por portal — null = todavía no
   * habilitado para esta aseguradora (ver 0162_portfolio_agent.sql). */
  portalDomain: string | null;
  connectionId: string | null;
  status: ConnectionStatus;
  method: ConnectionMethod | null;
  /** true si ya hay credenciales de portal guardadas en Vault para esta
   * conexión — nunca expone el secreto en sí, solo si existe. */
  hasPortalCredentials: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  policiesSynced: number;
  clientsSynced: number;
}

/** Catálogo (global) left-joined con la conexión propia del workspace +
 * estadísticas reales por conexión, contadas directo sobre policies
 * (insurance_connection_id) — nunca un contador aparte a mantener
 * sincronizado a mano. */
export async function getInsuranceProvidersBoard(workspaceId: string): Promise<InsuranceProviderCard[]> {
  const supabase = await createClient();
  const [{ data: providers }, { data: connections }] = await Promise.all([
    supabase.from("insurance_providers").select("id, key, name, brand_color, available_methods, portal_domain, position").order("position", { ascending: true }),
    supabase
      .from("insurance_connections")
      .select("id, provider_id, status, method, connected_at, last_sync_at, last_error, credentials_vault_ref")
      .eq("workspace_id", workspaceId),
  ]);

  const connectionByProvider = new Map(
    (
      (connections ?? []) as {
        id: string;
        provider_id: string;
        status: string;
        method: string | null;
        connected_at: string | null;
        last_sync_at: string | null;
        last_error: string | null;
        credentials_vault_ref: string | null;
      }[]
    ).map((c) => [c.provider_id, c]),
  );
  const connectionIds = (connections ?? []).map((c) => c.id as string);

  const { data: policyStats } = connectionIds.length
    ? await supabase.from("policies").select("insurance_connection_id, contact_id").in("insurance_connection_id", connectionIds)
    : { data: [] as { insurance_connection_id: string; contact_id: string }[] };

  const policiesCountByConnection = new Map<string, number>();
  const clientsByConnection = new Map<string, Set<string>>();
  for (const row of (policyStats ?? []) as { insurance_connection_id: string; contact_id: string }[]) {
    const cid = row.insurance_connection_id;
    policiesCountByConnection.set(cid, (policiesCountByConnection.get(cid) ?? 0) + 1);
    if (!clientsByConnection.has(cid)) clientsByConnection.set(cid, new Set());
    clientsByConnection.get(cid)!.add(row.contact_id);
  }

  return (providers ?? []).map((p) => {
    const connection = connectionByProvider.get(p.id as string);
    const connectionId = connection?.id as string | undefined;
    return {
      id: p.id as string,
      key: p.key as string,
      name: p.name as string,
      brandColor: p.brand_color as string,
      availableMethods: p.available_methods as ConnectionMethod[],
      portalDomain: (p.portal_domain as string | null) ?? null,
      connectionId: connectionId ?? null,
      status: (connection?.status as ConnectionStatus | undefined) ?? "not_connected",
      method: (connection?.method as ConnectionMethod | null | undefined) ?? null,
      hasPortalCredentials: Boolean(connection?.credentials_vault_ref),
      connectedAt: (connection?.connected_at as string | null | undefined) ?? null,
      lastSyncAt: (connection?.last_sync_at as string | null | undefined) ?? null,
      lastError: (connection?.last_error as string | null | undefined) ?? null,
      policiesSynced: connectionId ? (policiesCountByConnection.get(connectionId) ?? 0) : 0,
      clientsSynced: connectionId ? (clientsByConnection.get(connectionId)?.size ?? 0) : 0,
    };
  });
}

export interface InsuranceProvidersSummary {
  totalProviders: number;
  connectedCount: number;
  totalPoliciesSynced: number;
  totalClientsSynced: number;
  lastSyncAt: string | null;
}

export function summarizeInsuranceProviders(board: InsuranceProviderCard[]): InsuranceProvidersSummary {
  const connected = board.filter((p) => p.status === "connected");
  const lastSyncAt = connected.reduce<string | null>((latest, p) => {
    if (!p.lastSyncAt) return latest;
    if (!latest || p.lastSyncAt > latest) return p.lastSyncAt;
    return latest;
  }, null);
  return {
    totalProviders: board.length,
    connectedCount: connected.length,
    totalPoliciesSynced: board.reduce((sum, p) => sum + p.policiesSynced, 0),
    totalClientsSynced: board.reduce((sum, p) => sum + p.clientsSynced, 0),
    lastSyncAt,
  };
}

export interface InsuranceSyncJobEntry {
  id: string;
  status: PortalSyncJobStatus;
  sourceFileName: string | null;
  currentStep: string | null;
  processedCount: number | null;
  totalCount: number | null;
  createdCount: number | null;
  updatedCount: number | null;
  cancelRequested: boolean;
  policiesSyncedCount: number;
  clientsSyncedCount: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  triggeredByName: string | null;
}

/** Historial de sincronizaciones de una conexión — para el panel
 * "Administrar conexión" y para el progreso en vivo de Analizador de
 * Cartera (mismo shape, la fila más reciente). */
export async function getInsuranceSyncJobs(workspaceId: string, connectionId: string): Promise<InsuranceSyncJobEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("insurance_sync_jobs")
    .select(
      "id, status, source_file_name, current_step, processed_count, total_count, created_count, updated_count, cancel_requested, policies_synced_count, clients_synced_count, error, started_at, completed_at, triggered_by",
    )
    .eq("workspace_id", workspaceId)
    .eq("connection_id", connectionId)
    .order("started_at", { ascending: false });
  const rows = data ?? [];

  const triggeredByIds = [...new Set(rows.map((r) => r.triggered_by).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = triggeredByIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>(((memberNames ?? []) as { member_id: string; full_name: string }[]).map((m) => [m.member_id, m.full_name]));

  return rows.map((r) => ({
    id: r.id as string,
    status: r.status as PortalSyncJobStatus,
    sourceFileName: r.source_file_name as string | null,
    currentStep: r.current_step as string | null,
    processedCount: r.processed_count as number | null,
    totalCount: r.total_count as number | null,
    createdCount: r.created_count as number | null,
    updatedCount: r.updated_count as number | null,
    cancelRequested: Boolean(r.cancel_requested),
    policiesSyncedCount: r.policies_synced_count as number,
    clientsSyncedCount: r.clients_synced_count as number,
    error: r.error as string | null,
    startedAt: r.started_at as string,
    completedAt: r.completed_at as string | null,
    triggeredByName: r.triggered_by ? (nameByMember.get(r.triggered_by as string) ?? null) : null,
  }));
}
