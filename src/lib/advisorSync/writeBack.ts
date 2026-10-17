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

/** Resultado de escribir el estado de una cita de vuelta en su fila de la hoja:
 * - written: se actualizó la celda ESTADO.
 * - not_from_sheet / disabled: la cita no vino de una hoja, o "Escribir cambios de vuelta" está apagado.
 * - no_token: falta la cuenta de Google con permiso de escritura.
 * - row_moved: la fila ya no tiene ese teléfono (la hoja se reordenó) — no se pisa otra fila;
 *   se corrige con "Actualizar".
 * - error: Google rechazó la escritura. */
export type SheetWriteBackStatus = "written" | "not_from_sheet" | "disabled" | "no_token" | "row_moved" | "no_estado_column" | "error";

function findColumn(headers: string[], columnMap: Record<string, AdvisorSyncFieldKey>, field: AdvisorSyncFieldKey): number {
  const normalizedMap = new Map(Object.entries(columnMap).map(([h, k]) => [normalizeForMatch(h), k]));
  return headers.findIndex((h) => h && (columnMap[h] ?? normalizedMap.get(normalizeForMatch(h))) === field);
}

/** "Si cambiás el estado acá, también se actualiza en la hoja" — se llama después de guardar el
 * estado en el CRM (agenda/queries.ts::updateEstadoCita). Nunca lanza. */
export async function writeEstadoBackToSheet(appointmentId: string, estado: EstadoCita): Promise<SheetWriteBackStatus> {
  try {
    const supabase = createServiceRoleClient();
    const { data: appointment } = await supabase
      .from("agenda_appointments")
      .select("sheet_connection_id, sheet_row_number, deleted_in_sheet, contacts(phone)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appointment?.sheet_connection_id || !appointment.sheet_row_number || appointment.deleted_in_sheet) return "not_from_sheet";

    const { data: connection } = await supabase
      .from("advisor_sheet_connections")
      .select("workspace_id, spreadsheet_id, sheet_name, header_row, column_map, value_map, options")
      .eq("id", appointment.sheet_connection_id as string)
      .maybeSingle();
    if (!connection) return "not_from_sheet";
    const options: AgendaSheetOptions = { ...DEFAULT_AGENDA_SHEET_OPTIONS, ...((connection.options as Partial<AgendaSheetOptions>) ?? {}) };
    if (!options.write_back) return "disabled";

    const token = await getValidGoogleSheetsExportAccessToken(connection.workspace_id as string);
    if (!token) return "no_token";

    const sheet = quoteSheetName(connection.sheet_name as string);
    const headerRow = connection.header_row as number;
    const rowNumber = appointment.sheet_row_number as number;
    const [headerValues, rowValues] = await Promise.all([
      fetchRangeValues(token, connection.spreadsheet_id as string, `${sheet}!${headerRow}:${headerRow}`),
      fetchRangeValues(token, connection.spreadsheet_id as string, `${sheet}!${rowNumber}:${rowNumber}`),
    ]);
    const headers = headerValues[0] ?? [];
    const row = rowValues[0] ?? [];
    const columnMap = (connection.column_map as Record<string, AdvisorSyncFieldKey>) ?? {};

    const estadoCol = findColumn(headers, columnMap, "estado");
    if (estadoCol < 0) return "no_estado_column";

    // La fila tiene que seguir siendo la de este lead: si la hoja se reordenó desde la última
    // "Actualizar", sheet_row_number apunta a otra persona y no se escribe nada.
    const phoneCol = findColumn(headers, columnMap, "phone");
    const contact = Array.isArray(appointment.contacts) ? appointment.contacts[0] : appointment.contacts;
    const expected = new Set(phoneLookupCandidates(phoneDigits((contact as { phone: string | null } | null)?.phone)).map(phoneDigits));
    if (phoneCol < 0 || !expected.has(phoneDigits(row[phoneCol]))) return "row_moved";

    const text = sheetTextForEstado(estado, (connection.value_map as ValueMap) ?? {}, ESTADO_CITA_META[estado].label);
    await writeCellA1(token, connection.spreadsheet_id as string, `${sheet}!${columnLetter(estadoCol)}${rowNumber}`, text);
    return "written";
  } catch (err) {
    console.error(`[agenda write-back] cita ${appointmentId}:`, err);
    return "error";
  }
}
