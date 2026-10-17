import { normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import type { AdvisorSyncFieldKey } from "./fieldDictionary";
import { appointmentRowKey, parseSheetDate, phoneDigits, type ParsedSheetDate } from "./rowParsing";

/** Una fila de la hoja de agendas ya interpretada — misma lectura para la vista previa del panel
 * y para la sync real (runner.ts), así lo que muestra la vista previa es lo que se importa. */
export interface AgendaSheetRow {
  /** Número de fila tal como lo ve el usuario en Google Sheets (1-based). */
  rowNumber: number;
  values: Partial<Record<AdvisorSyncFieldKey, string>>;
  digits: string;
  parsed: ParsedSheetDate | null;
  /** Identidad estable (teléfono + día; "ext:" si hay columna de ID externo). null si falta
   * teléfono o la fecha es inválida — la fila no se puede importar. */
  key: string | null;
  problems: AgendaRowProblem[];
}

export type AgendaRowProblem = "sin_hora" | "sin_telefono" | "fecha_invalida" | "sin_fecha" | "sin_nombre";

export const AGENDA_ROW_PROBLEM_LABELS: Record<AgendaRowProblem, string> = {
  sin_hora: "Sin hora",
  sin_telefono: "Sin teléfono",
  fecha_invalida: "Fecha inválida",
  sin_fecha: "Sin fecha",
  sin_nombre: "Sin nombre",
};

/** Problemas que impiden importar la fila (sin hora NO: se importa como "sin hora"). */
export function isBlockingProblem(problem: AgendaRowProblem): boolean {
  return problem !== "sin_hora";
}

function cellText(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  return String(raw).trim();
}

export function parseAgendaSheetRows(
  rows: unknown[][],
  headerRow: number,
  columnMap: Record<string, AdvisorSyncFieldKey>,
  utcOffsetMinutes: number,
  now: Date = new Date(),
): { headers: string[]; items: AgendaSheetRow[] } {
  const headerIdx = headerRow - 1;
  const headers = (rows[headerIdx] ?? []).map(cellText);
  const normalizedMap = new Map(Object.entries(columnMap).map(([header, key]) => [normalizeForMatch(header), key]));
  const fieldByColumn = headers.map((h) => (h ? (columnMap[h] ?? normalizedMap.get(normalizeForMatch(h)) ?? null) : null));

  const items: AgendaSheetRow[] = [];
  const keyCounts = new Map<string, number>();

  rows.slice(headerIdx + 1).forEach((row, i) => {
    const values: Partial<Record<AdvisorSyncFieldKey, string>> = {};
    fieldByColumn.forEach((fieldKey, col) => {
      if (!fieldKey) return;
      const text = cellText(row?.[col]);
      if (text) values[fieldKey] = text;
    });

    // Filas vacías (sin nombre ni teléfono) se saltean en silencio — pedido explícito.
    if (!values.leadName && !values.phone) return;

    const problems: AgendaRowProblem[] = [];
    const digits = phoneDigits(values.phone);
    if (!values.leadName) problems.push("sin_nombre");
    if (!digits) problems.push("sin_telefono");
    let parsed: ParsedSheetDate | null = null;
    if (!values.date) problems.push("sin_fecha");
    else {
      parsed = parseSheetDate(values.date, values.time, utcOffsetMinutes, now);
      if (!parsed) problems.push("fecha_invalida");
      else if (parsed.sinHora) problems.push("sin_hora");
    }

    let key: string | null = null;
    if (!problems.some(isBlockingProblem) && parsed) {
      const base = values.externalId ? `ext:${values.externalId}` : appointmentRowKey(digits, parsed.date, utcOffsetMinutes);
      // Misma persona dos veces el mismo día (dos citas) → claves distintas, en orden de aparición.
      const count = (keyCounts.get(base) ?? 0) + 1;
      keyCounts.set(base, count);
      key = count === 1 ? base : `${base}#${count}`;
    }

    items.push({ rowNumber: headerIdx + 2 + i, values, digits, parsed, key, problems });
  });

  return { headers, items };
}
