import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentSyncFieldKey } from "./fieldDictionary";

export interface AppointmentSheetConnectionRow {
  id: string;
  spreadsheetId: string;
  sheetGid: string | null;
  sheetName: string;
  columnMap: Record<string, AppointmentSyncFieldKey>;
  status: "active" | "paused";
  lastSyncedAt: string | null;
  lastSyncStatus: "pending" | "ok" | "error";
  lastSyncError: string | null;
  rowCount: number;
  createdAt: string;
}

export async function getAppointmentSheetConnections(workspaceId: string): Promise<AppointmentSheetConnectionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment_sheet_connections")
    .select("id, spreadsheet_id, sheet_gid, sheet_name, column_map, status, last_synced_at, last_sync_status, last_sync_error, row_count, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    spreadsheetId: r.spreadsheet_id as string,
    sheetGid: r.sheet_gid as string | null,
    sheetName: r.sheet_name as string,
    columnMap: (r.column_map as Record<string, AppointmentSyncFieldKey>) ?? {},
    status: r.status as "active" | "paused",
    lastSyncedAt: r.last_synced_at as string | null,
    lastSyncStatus: r.last_sync_status as "pending" | "ok" | "error",
    lastSyncError: r.last_sync_error as string | null,
    rowCount: r.row_count as number,
    createdAt: r.created_at as string,
  }));
}

export interface AppointmentSheetRowErrorItem {
  rowKey: string;
  errorMessage: string | null;
  syncedAt: string;
}

/** Filas en error de la última corrida — para el panel de sync mostrar qué
 * filas necesitan corregirse (setter/asesor mal escrito, fecha inválida). */
export async function getAppointmentSheetRowErrors(connectionId: string): Promise<AppointmentSheetRowErrorItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment_sheet_rows")
    .select("row_key, error_message, synced_at")
    .eq("connection_id", connectionId)
    .eq("status", "error")
    .order("synced_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({ rowKey: r.row_key as string, errorMessage: r.error_message as string | null, syncedAt: r.synced_at as string }));
}

/** Roster setter↔asesor del workspace — solo las claves; la UI resuelve
 * nombres cruzando con getClientsList/getWorkspaceMembersList, sin duplicar
 * esa resolución acá. */
export async function getAdvisorSetterAssignments(workspaceId: string): Promise<{ setterId: string; clientId: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("advisor_setter_assignments").select("setter_id, client_id").eq("workspace_id", workspaceId);
  return (data ?? []).map((r) => ({ setterId: r.setter_id as string, clientId: r.client_id as string }));
}
