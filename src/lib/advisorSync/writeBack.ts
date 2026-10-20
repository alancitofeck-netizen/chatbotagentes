import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import { getValidGoogleSheetsExportAccessToken, fetchRangeValues, writeCellA1, quoteSheetName, columnLetter } from "@/lib/integrations/googleSheetsExport";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";
import { sheetTextForEstado, type ValueMap } from "@/lib/agenda/sheetValueOptions";
import type { EstadoCita } from "@/lib/agenda/queries";
import type { AdvisorSyncFieldKey } from "./fieldDictionary";
import { phoneDigits, phoneLookupCandidates } from "./rowParsing";
import { DEFAULT_AGENDA_SHEET_OPTIONS, type AgendaSheetOptions } from "./runner";

/** Resultado de escribir un campo de una cita de vuelta en su fila de la hoja:
 * - written: se actualizó la celda.
 * - not_from_sheet / disabled: la cita no vino de una hoja, o "Escribir cambios de vuelta" está apagado.
 * - no_token: falta la cuenta de Google con permiso de escritura.
 * - row_moved: la fila ya no tiene ese teléfono (la hoja se reordenó) — no se pisa otra fila;
 *   se corrige con "Actualizar".
 * - no_estado_column: la hoja no tiene una columna mapeada para ese campo (estado o notas).
 * - error: Google rechazó la escritura. */
export type SheetWriteBackStatus = "written" | "not_from_sheet" | "disabled" | "no_token" | "row_moved" | "no_estado_column" | "error";

function findColumn(headers: string[], columnMap: Record<string, AdvisorSyncFieldKey>, field: AdvisorSyncFieldKey): number {
  const normalizedMap = new Map(Object.entries(columnMap).map(([h, k]) => [normalizeForMatch(h), k]));
  return headers.findIndex((h) => h && (columnMap[h] ?? normalizedMap.get(normalizeForMatch(h))) === field);
}

/** Preparación compartida por writeEstadoBackToSheet/writeNotesBackToSheet: resuelve la conexión,
 * valida que el write-back esté habilitado, trae headers+fila actual y confirma que la fila sigue
 * siendo la de este lead (mismo teléfono). Devuelve el status de corte si algo no está listo para
 * escribir, o el contexto ya armado para escribir una columna puntual. */
async function prepareSheetWrite(
  appointmentId: string,
): Promise<{ status: SheetWriteBackStatus } | { token: string; spreadsheetId: string; sheet: string; rowNumber: number; headers: string[]; columnMap: Record<string, AdvisorSyncFieldKey>; valueMap: ValueMap }> {
  const supabase = createServiceRoleClient();
  const { data: appointment } = await supabase
    .from("agenda_appointments")
    .select("sheet_connection_id, sheet_row_number, deleted_in_sheet, contacts(phone)")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment?.sheet_connection_id || !appointment.sheet_row_number || appointment.deleted_in_sheet) return { status: "not_from_sheet" };

  const { data: connection } = await supabase
    .from("advisor_sheet_connections")
    .select("workspace_id, spreadsheet_id, sheet_name, header_row, column_map, value_map, options")
    .eq("id", appointment.sheet_connection_id as string)
    .maybeSingle();
  if (!connection) return { status: "not_from_sheet" };
  const options: AgendaSheetOptions = { ...DEFAULT_AGENDA_SHEET_OPTIONS, ...((connection.options as Partial<AgendaSheetOptions>) ?? {}) };
  if (!options.write_back) return { status: "disabled" };

  const token = await getValidGoogleSheetsExportAccessToken(connection.workspace_id as string);
  if (!token) return { status: "no_token" };

  const sheet = quoteSheetName(connection.sheet_name as string);
  const headerRow = connection.header_row as number;
  const rowNumber = appointment.sheet_row_number as number;
  const spreadsheetId = connection.spreadsheet_id as string;
  const [headerValues, rowValues] = await Promise.all([
    fetchRangeValues(token, spreadsheetId, `${sheet}!${headerRow}:${headerRow}`),
    fetchRangeValues(token, spreadsheetId, `${sheet}!${rowNumber}:${rowNumber}`),
  ]);
  const headers = headerValues[0] ?? [];
  const row = rowValues[0] ?? [];
  const columnMap = (connection.column_map as Record<string, AdvisorSyncFieldKey>) ?? {};

  // La fila tiene que seguir siendo la de este lead: si la hoja se reordenó desde la última
  // "Actualizar", sheet_row_number apunta a otra persona y no se escribe nada.
  const phoneCol = findColumn(headers, columnMap, "phone");
  const contact = Array.isArray(appointment.contacts) ? appointment.contacts[0] : appointment.contacts;
  const expected = new Set(phoneLookupCandidates(phoneDigits((contact as { phone: string | null } | null)?.phone)).map(phoneDigits));
  if (phoneCol < 0 || !expected.has(phoneDigits(row[phoneCol]))) return { status: "row_moved" };

  return { token, spreadsheetId, sheet, rowNumber, headers, columnMap, valueMap: (connection.value_map as ValueMap) ?? {} };
}

/** "Si cambiás el estado acá, también se actualiza en la hoja" — se llama después de guardar el
 * estado en el CRM (agenda/queries.ts::updateEstadoCita). Nunca lanza. */
export async function writeEstadoBackToSheet(appointmentId: string, estado: EstadoCita): Promise<SheetWriteBackStatus> {
  try {
    const ctx = await prepareSheetWrite(appointmentId);
    if ("status" in ctx) return ctx.status;

    const estadoCol = findColumn(ctx.headers, ctx.columnMap, "estado");
    if (estadoCol < 0) return "no_estado_column";

    const text = sheetTextForEstado(estado, ctx.valueMap, ESTADO_CITA_META[estado].label);
    await writeCellA1(ctx.token, ctx.spreadsheetId, `${ctx.sheet}!${columnLetter(estadoCol)}${ctx.rowNumber}`, text);
    return "written";
  } catch (err) {
    console.error(`[agenda write-back] estado de cita ${appointmentId}:`, err);
    return "error";
  }
}

/** "Notas del setter" en el panel de detalle — mismo mecanismo, sobre la columna mapeada a Notas. */
export async function writeNotesBackToSheet(appointmentId: string, notas: string): Promise<SheetWriteBackStatus> {
  try {
    const ctx = await prepareSheetWrite(appointmentId);
    if ("status" in ctx) return ctx.status;

    const notesCol = findColumn(ctx.headers, ctx.columnMap, "notes");
    if (notesCol < 0) return "no_estado_column";

    await writeCellA1(ctx.token, ctx.spreadsheetId, `${ctx.sheet}!${columnLetter(notesCol)}${ctx.rowNumber}`, notas);
    return "written";
  } catch (err) {
    console.error(`[agenda write-back] notas de cita ${appointmentId}:`, err);
    return "error";
  }
}
