"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole, requirePlatformAdmin } from "@/lib/auth/roles";
import { getValidGoogleSheetsAccessToken, fetchSpreadsheetMetadata, fetchSheetValues, parseSpreadsheetId } from "@/lib/integrations/googleSheets";
import { detectAppointmentSyncColumnMapping } from "./fieldDictionary";
import { runAppointmentSheetSync } from "./runner";
import { getAppointmentSheetConnections, getAppointmentSheetRowErrors, getAdvisorSetterAssignments } from "./queries";
import type { AppointmentSyncFieldKey } from "./fieldDictionary";

async function requireSheetsToken(workspaceId: string): Promise<string> {
  const token = await getValidGoogleSheetsAccessToken(workspaceId);
  if (!token) throw new Error("Conectá Google Sheets primero (Perfil → Integraciones).");
  return token;
}

export async function getAppointmentSheetConnectionsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAppointmentSheetConnections(workspaceId);
}

export async function getAppointmentSheetRowErrorsAction(connectionId: string) {
  await requireActiveWorkspace();
  return getAppointmentSheetRowErrors(connectionId);
}

export async function inspectAppointmentSpreadsheetAction(spreadsheetUrlOrId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const spreadsheetId = parseSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId) throw new Error("No pudimos reconocer ese link o ID de Google Sheets.");
  const token = await requireSheetsToken(workspaceId);
  const metadata = await fetchSpreadsheetMetadata(token, spreadsheetId);
  return { spreadsheetId, ...metadata };
}

export async function inspectAppointmentSheetColumnsAction(spreadsheetId: string, sheetName: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const token = await requireSheetsToken(workspaceId);
  const rows = await fetchSheetValues(token, spreadsheetId, sheetName);
  const headers = rows[0] ?? [];
  const sampleRows = rows.slice(1, 4);
  const suggestions = detectAppointmentSyncColumnMapping(headers);
  return { headers, sampleRows, suggestions };
}

export interface SaveAppointmentSheetConnectionInput {
  connectionId?: string;
  spreadsheetId: string;
  sheetGid: string | null;
  sheetName: string;
  columnMap: Record<string, AppointmentSyncFieldKey>;
}

export async function saveAppointmentSheetConnectionAction(input: SaveAppointmentSheetConnectionInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const mapped = new Set(Object.values(input.columnMap));
  const required: AppointmentSyncFieldKey[] = ["leadName", "phone", "advisorName", "setterName", "date"];
  const missing = required.filter((key) => !mapped.has(key));
  if (missing.length > 0) throw new Error("Mapeá al menos Cliente, Teléfono, Asesor, Setter y Fecha antes de guardar.");

  const supabase = await createClient();
  const payload = {
    workspace_id: workspaceId,
    spreadsheet_id: input.spreadsheetId,
    sheet_gid: input.sheetGid,
    sheet_name: input.sheetName,
    column_map: input.columnMap,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = input.connectionId
    ? await supabase.from("appointment_sheet_connections").update(payload).eq("id", input.connectionId).select("id").single()
    : await supabase.from("appointment_sheet_connections").insert(payload).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo guardar la conexión.");

  revalidatePath("/profile");
  return { id: data.id as string };
}

export async function pauseAppointmentSheetConnectionAction(connectionId: string, status: "active" | "paused") {
  const { role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  await supabase.from("appointment_sheet_connections").update({ status }).eq("id", connectionId);
  revalidatePath("/profile");
}

export async function deleteAppointmentSheetConnectionAction(connectionId: string) {
  const { role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  await supabase.from("appointment_sheet_connections").delete().eq("id", connectionId);
  revalidatePath("/profile");
}

/** "Sincronizar ahora" — misma runAppointmentSheetSync que usa el cron, para
 * una sola conexión en vez de un lote. */
export async function triggerManualAppointmentSheetSyncAction(connectionId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { data } = await supabase.from("appointment_sheet_connections").select("*").eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new Error("Conexión no encontrada.");

  const result = await runAppointmentSheetSync({
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    spreadsheet_id: data.spreadsheet_id as string,
    sheet_name: data.sheet_name as string,
    column_map: (data.column_map as Record<string, AppointmentSyncFieldKey>) ?? {},
    last_sheet_hash: (data.last_sheet_hash as string | null) ?? null,
  });
  revalidatePath("/profile");
  revalidatePath("/crm/agenda");
  return result;
}

export async function getAdvisorSetterAssignmentsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAdvisorSetterAssignments(workspaceId);
}

/** Reemplaza el set completo de asesores asignados a un setter (checkboxes
 * en la UI) — más simple que diffear insert/delete fila a fila. Gateado
 * también a platform admin (no solo owner/admin) porque `clientIds`
 * referencia fichas de asesores — mismo criterio de sensibilidad que
 * getClientsListAction (src/lib/clients/actions.ts). */
export async function setAdvisorAssignmentsForSetterAction(setterId: string, clientIds: string[]) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.from("advisor_setter_assignments").delete().eq("workspace_id", workspaceId).eq("setter_id", setterId);
  if (clientIds.length > 0) {
    await supabase.from("advisor_setter_assignments").insert(clientIds.map((clientId) => ({ workspace_id: workspaceId, client_id: clientId, setter_id: setterId })));
  }
  revalidatePath("/profile");
}
