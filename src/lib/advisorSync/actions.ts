"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireAgencyManagerRole } from "@/lib/auth/roles";
import { getValidGoogleSheetsAccessToken, fetchSpreadsheetMetadata, fetchSheetValues, parseSpreadsheetId } from "@/lib/integrations/googleSheets";
import { detectAdvisorSyncColumnMapping } from "./fieldDictionary";
import { runAdvisorSheetSync } from "./runner";
import { getAdvisorSheetConnections, getAdvisorOptions, getAdvisorSheetRowErrors } from "./queries";
import type { AdvisorSyncFieldKey } from "./fieldDictionary";

async function requireSheetsToken(workspaceId: string): Promise<string> {
  const token = await getValidGoogleSheetsAccessToken(workspaceId);
  if (!token) throw new Error("Conectá Google Sheets primero (Perfil → Integraciones).");
  return token;
}

export async function getAdvisorSheetConnectionsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAdvisorSheetConnections(workspaceId);
}

export async function getAdvisorOptionsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAdvisorOptions(workspaceId);
}

export async function getAdvisorSheetRowErrorsAction(connectionId: string) {
  await requireActiveWorkspace();
  return getAdvisorSheetRowErrors(connectionId);
}

export async function inspectAdvisorSpreadsheetAction(spreadsheetUrlOrId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const spreadsheetId = parseSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId) throw new Error("No pudimos reconocer ese link o ID de Google Sheets.");
  const token = await requireSheetsToken(workspaceId);
  const metadata = await fetchSpreadsheetMetadata(token, spreadsheetId);
  return { spreadsheetId, ...metadata };
}

/** `headerRow` (1-based, default 1 — igual que el número de fila que ve el
 * usuario en Sheets). Algunas hojas tienen una fila de título arriba de los
 * encabezados reales (ej. una celda "AGENDAS" sola en la fila 1, con
 * FECHA/HORA/... recién en la fila 2). El wizard deja cambiarla si la fila
 * 1 no trae las columnas esperadas — la API de Sheets no informa dónde
 * "empiezan" los datos, así que no hay forma de detectarlo sin mirar el
 * contenido. `preview` son las primeras filas crudas, para que el usuario
 * elija la fila correcta mirando el contenido real. */
export async function inspectAdvisorSheetColumnsAction(spreadsheetId: string, sheetName: string, headerRow = 1) {
  const { workspaceId } = await requireActiveWorkspace();
  const token = await requireSheetsToken(workspaceId);
  const rows = await fetchSheetValues(token, spreadsheetId, sheetName);
  const headerIdx = headerRow - 1;
  const headers = rows[headerIdx] ?? [];
  const sampleRows = rows.slice(headerIdx + 1, headerIdx + 4);
  const suggestions = detectAdvisorSyncColumnMapping(headers);
  const preview = rows.slice(0, 6);
  return { headers, sampleRows, suggestions, preview };
}

export interface SaveAdvisorSheetConnectionInput {
  connectionId?: string;
  advisorClientId: string;
  spreadsheetId: string;
  sheetGid: string | null;
  sheetName: string;
  columnMap: Record<string, AdvisorSyncFieldKey>;
  headerRow: number;
}

export async function saveAdvisorSheetConnectionAction(input: SaveAdvisorSheetConnectionInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  await requireAgencyManagerRole(workspaceId, role);
  if (!input.advisorClientId) throw new Error("Elegí un asesor antes de guardar.");
  const mapped = new Set(Object.values(input.columnMap));
  const required: AdvisorSyncFieldKey[] = ["leadName", "phone", "setterName", "date"];
  const missing = required.filter((key) => !mapped.has(key));
  if (missing.length > 0) throw new Error("Mapeá al menos Nombre del lead, Teléfono, Setter y Fecha antes de guardar.");

  const supabase = await createClient();
  const payload = {
    workspace_id: workspaceId,
    advisor_client_id: input.advisorClientId,
    spreadsheet_id: input.spreadsheetId,
    sheet_gid: input.sheetGid,
    sheet_name: input.sheetName,
    column_map: input.columnMap,
    header_row: input.headerRow,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = input.connectionId
    ? await supabase.from("advisor_sheet_connections").update(payload).eq("id", input.connectionId).select("id").single()
    : await supabase.from("advisor_sheet_connections").insert(payload).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo guardar la conexión. ¿Ese asesor ya tiene una conexión activa?");

  revalidatePath("/profile");
  return { id: data.id as string };
}

export async function pauseAdvisorSheetConnectionAction(connectionId: string, status: "active" | "paused") {
  const { workspaceId, role } = await requireActiveWorkspace();
  await requireAgencyManagerRole(workspaceId, role);
  const supabase = await createClient();
  await supabase.from("advisor_sheet_connections").update({ status }).eq("id", connectionId);
  revalidatePath("/profile");
}

export async function deleteAdvisorSheetConnectionAction(connectionId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  await requireAgencyManagerRole(workspaceId, role);
  const supabase = await createClient();
  await supabase.from("advisor_sheet_connections").delete().eq("id", connectionId);
  revalidatePath("/profile");
}

/** "Sincronizar ahora" — misma runAdvisorSheetSync que usa el cron, para una
 * sola conexión en vez de un lote. */
export async function triggerManualAdvisorSheetSyncAction(connectionId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  await requireAgencyManagerRole(workspaceId, role);
  const supabase = await createClient();
  const { data } = await supabase.from("advisor_sheet_connections").select("*").eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new Error("Conexión no encontrada.");

  const result = await runAdvisorSheetSync({
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    advisor_client_id: data.advisor_client_id as string,
    spreadsheet_id: data.spreadsheet_id as string,
    sheet_name: data.sheet_name as string,
    column_map: (data.column_map as Record<string, AdvisorSyncFieldKey>) ?? {},
    header_row: (data.header_row as number) ?? 1,
    last_sheet_hash: (data.last_sheet_hash as string | null) ?? null,
  }, "manual");
  revalidatePath("/profile");
  revalidatePath("/agenda");
  revalidatePath("/crm");
  return result;
}
