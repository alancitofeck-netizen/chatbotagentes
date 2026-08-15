import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRealAdvisorWorkspaces } from "@/lib/clients/queries";
import { normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import type { AdvisorSyncFieldKey } from "./fieldDictionary";
import type { AdvisorSheetConnectionRow } from "./types";

/** Conexiones activas del workspace de la agencia, una por asesor. El
 * nombre del asesor NO sale de clients.contact_id (esa columna nunca se
 * completa para asesores reales — ver ensureAdvisorRecordsExist,
 * src/lib/clients/queries.ts, "no fabrica ningún dato"), sale de
 * getRealAdvisorWorkspaces (mismo mecanismo que la lista de Asesores:
 * primer miembro real del workspace vinculado + auth.admin.getUserById). */
export async function getAdvisorSheetConnections(workspaceId: string): Promise<AdvisorSheetConnectionRow[]> {
  const supabase = await createClient();
  const [{ data }, advisors] = await Promise.all([
    supabase
      .from("advisor_sheet_connections")
      .select(
        "id, advisor_client_id, spreadsheet_id, sheet_gid, sheet_name, column_map, header_row, status, last_synced_at, last_sync_status, last_sync_error, row_count, last_sheet_hash, created_at, clients!advisor_sheet_connections_advisor_client_id_fkey(linked_workspace_id)",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getRealAdvisorWorkspaces(),
  ]);

  const nameByLinkedWorkspace = new Map(advisors.map((a) => [a.workspaceId, a.name]));

  return (data ?? []).map((r) => {
    const clientRaw = r.clients as { linked_workspace_id: string | null } | { linked_workspace_id: string | null }[] | null;
    const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
    const linkedWorkspaceId = client?.linked_workspace_id ?? null;
    return {
      id: r.id as string,
      advisorClientId: r.advisor_client_id as string,
      advisorName: (linkedWorkspaceId && nameByLinkedWorkspace.get(linkedWorkspaceId)) ?? "—",
      spreadsheetId: r.spreadsheet_id as string,
      sheetGid: r.sheet_gid as string | null,
      sheetName: r.sheet_name as string,
      columnMap: (r.column_map as Record<string, AdvisorSyncFieldKey>) ?? {},
      headerRow: (r.header_row as number) ?? 1,
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

export interface AdvisorMatch {
  clientId: string;
  hasConnection: boolean;
}

/** Resuelve un asesor por nombre escrito a mano — nunca se lista el roster
 * completo de asesores en la UI (pedido explícito: otros agentes del
 * workspace de la agencia no tienen que poder ver qué cuentas existen en el
 * CRM navegando un desplegable). Primero intenta `clients.sheet_alias`
 * (texto exacto que el propio asesor definió para sí — ver 0138), después
 * el nombre real (getRealAdvisorWorkspaces, mismo mecanismo que la lista de
 * Asesores) exacto o por substring — nunca aproximado por puntaje, así
 * nunca asocia la hoja al asesor equivocado. Devuelve null sin distinguir
 * "no existe" de "no coincide" — mismo mensaje genérico en la acción que la
 * llama, para no convertir esto en un oráculo de qué nombres son válidos. */
export async function findAdvisorClientByName(workspaceId: string, nameInput: string): Promise<AdvisorMatch | null> {
  const trimmed = nameInput.trim();
  if (!trimmed) return null;
  const normalized = normalizeForMatch(trimmed);

  const supabase = await createClient();
  const [{ data: clients }, { data: connections }, advisors] = await Promise.all([
    supabase.from("clients").select("id, linked_workspace_id, sheet_alias").eq("workspace_id", workspaceId).not("linked_workspace_id", "is", null),
    supabase.from("advisor_sheet_connections").select("advisor_client_id").eq("workspace_id", workspaceId),
    getRealAdvisorWorkspaces(),
  ]);

  const connectedIds = new Set((connections ?? []).map((c) => c.advisor_client_id as string));
  const nameByLinkedWorkspace = new Map(advisors.map((a) => [a.workspaceId, a.name]));
  const rows = (clients ?? []) as { id: string; linked_workspace_id: string; sheet_alias: string | null }[];

  const byAlias = rows.find((c) => c.sheet_alias && normalizeForMatch(c.sheet_alias) === normalized);
  const match =
    byAlias ??
    rows.find((c) => {
      const name = nameByLinkedWorkspace.get(c.linked_workspace_id);
      if (!name) return false;
      const normalizedName = normalizeForMatch(name);
      return normalizedName === normalized || normalizedName.includes(normalized) || normalized.includes(normalizedName);
    });

  if (!match) return null;
  return { clientId: match.id, hasConnection: connectedIds.has(match.id) };
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
