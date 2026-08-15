import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdvisorSyncFieldKey } from "./fieldDictionary";
import type { AdvisorSheetConnectionRow, AdvisorOption } from "./types";

/** Conexiones activas del workspace de la agencia, una por asesor — el
 * nombre del asesor se resuelve vía clients→contacts (mismo join que
 * getClientsList usa para el listado de Asesores). */
export async function getAdvisorSheetConnections(workspaceId: string): Promise<AdvisorSheetConnectionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisor_sheet_connections")
    .select(
      "id, advisor_client_id, spreadsheet_id, sheet_gid, sheet_name, column_map, status, last_synced_at, last_sync_status, last_sync_error, row_count, last_sheet_hash, created_at, clients!advisor_sheet_connections_advisor_client_id_fkey(contacts!clients_contact_id_fkey(name))",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const clientRaw = r.clients as { contacts: { name: string } | { name: string }[] | null } | { contacts: { name: string } | { name: string }[] | null }[] | null;
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
    const contactRaw = client?.contacts;
    const contact = Array.isArray(contactRaw) ? contactRaw[0] : contactRaw;
    return {
      id: r.id as string,
      advisorClientId: r.advisor_client_id as string,
      advisorName: (contact?.name as string | undefined) ?? "—",
      spreadsheetId: r.spreadsheet_id as string,
      sheetGid: r.sheet_gid as string | null,
      sheetName: r.sheet_name as string,
      columnMap: (r.column_map as Record<string, AdvisorSyncFieldKey>) ?? {},
      status: r.status as "active" | "paused",
      lastSyncedAt: r.last_synced_at as string | null,
      lastSyncStatus: r.last_sync_status as "pending" | "ok" | "error",
      lastSyncError: r.last_sync_error as string | null,
      rowCount: r.row_count as number,
      lastSheetHash: r.last_sheet_hash as string | null,
      createdAt: r.created_at as string,
    };
  });
}

/** Asesores elegibles para conectar una hoja — solo los que ya tienen una
 * cuenta real vinculada (linked_workspace_id), igual criterio que
 * appointmentSync/runner.ts usaba para resolver advisors. `hasConnection`
 * deja que el wizard oculte/avise sobre asesores que ya tienen su conexión
 * (un asesor = una conexión, ver unique(workspace_id, advisor_client_id)). */
export async function getAdvisorOptions(workspaceId: string): Promise<AdvisorOption[]> {
  const supabase = await createClient();
  const [{ data: clients }, { data: connections }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, linked_workspace_id, contacts!clients_contact_id_fkey(name)")
      .eq("workspace_id", workspaceId)
      .not("linked_workspace_id", "is", null)
      .order("created_at", { ascending: true }),
    supabase.from("advisor_sheet_connections").select("advisor_client_id").eq("workspace_id", workspaceId),
  ]);

  const connectedIds = new Set((connections ?? []).map((c) => c.advisor_client_id as string));
  return ((clients ?? []) as { id: string; contacts: { name: string } | { name: string }[] | null }[]).map((c) => {
    const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
    return { clientId: c.id, name: contact?.name ?? "—", hasConnection: connectedIds.has(c.id) };
  });
}

export interface AdvisorSheetRowErrorItem {
  rowKey: string;
  errorMessage: string | null;
  syncedAt: string;
}

export async function getAdvisorSheetRowErrors(connectionId: string): Promise<AdvisorSheetRowErrorItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisor_sheet_rows")
    .select("row_key, error_message, synced_at")
    .eq("connection_id", connectionId)
    .eq("status", "error")
    .order("synced_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({ rowKey: r.row_key as string, errorMessage: r.error_message as string | null, syncedAt: r.synced_at as string }));
}
