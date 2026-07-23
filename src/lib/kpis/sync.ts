import { createHash } from "crypto";

/**
 * Pure ingestion logic — no network/DB calls in this file, testable with
 * plain arrays. The real sheet layout (confirmed with the user, one file
 * per setter) is a raw per-lead detail table — one row per lead, with a
 * real date and status dropdowns — NOT a pre-aggregated row per week. This
 * reads that raw table and replicates the setter's own COUNTIF-style
 * summary formulas per week bucket (derived from each lead's date), rather
 * than depending on the sheet's own summary cells (which aren't
 * week-scoped — they're a running total over the whole table).
 *
 * Column mapping is BY NAME (never fixed position), tolerant of
 * accents/case/extra whitespace and of the sheet's columns being reordered.
 */

export interface KpiWeekBucket {
  periodMonth: string; // ISO date, first-of-month
  weekNumber: number; // 1-4
  conexion: number;
  conexionesAceptadas: number;
  respuestasPrimerMensaje: number;
  primerMensajeEnviado: number;
  enConversacion: number;
  noLeInteresa: number;
  seguimientoConversacion: number;
  seguimientoAgenda: number;
  agendaManual: number;
  calificadas: number;
  sourceRowHash: string;
}

export interface SyncParseResult {
  buckets: KpiWeekBucket[];
  skippedRows: number;
  columnMap: Record<string, number>;
  warnings: string[];
}

/** Accepts unknown, not just string — the sheet's own summary block has
 * rows of plain numbers (e.g. the totals row: 200, 119, 62...), and
 * findHeaderRowIndex scans arbitrary rows including that one while looking
 * for the real detail-table header, so this must never assume a string. */
function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeValue(raw: string | undefined): string {
  return normalizeHeader(String(raw ?? ""));
}

// Confirmed with the user against the real sheet's headers (Hoja 1): each
// alias list tolerates the exact wording they used, plus close variants.
const COLUMN_ALIASES: Record<string, string[]> = {
  fecha: ["fecha de solicitud", "fecha"],
  conexionStatus: ["conexion"],
  respuestaPrimerMensaje: ["respuesta al 1er mensaje", "respuesta 1er mensaje", "respuestas al 1er mensaje"],
  estadoLead: ["estado del lead"],
  mensajeEnviado: ["mensaje 1 enviado", "1er mensaje enviado", "primer mensaje enviado"],
  citaCalificada: ["cita calificada"],
  seguimientoConversacion: ["en seguimiento de la conversacion", "seguimiento de la conversacion", "seguimiento conversacion"],
  seguimientoAgenda: ["en seguimiento de la agenda", "seguimiento de la agenda", "seguimiento agenda"],
};

const REQUIRED_KEYS = [
  "fecha",
  "conexionStatus",
  "respuestaPrimerMensaje",
  "estadoLead",
  "mensajeEnviado",
  "citaCalificada",
  "seguimientoConversacion",
  "seguimientoAgenda",
] as const;

function buildColumnMap(headerRow: unknown[]): { map: Record<string, number>; missing: string[] } {
  const normalized = headerRow.map(normalizeHeader);
  const map: Record<string, number> = {};

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[key] = idx;
  }

  const missing = REQUIRED_KEYS.filter((k) => !(k in map));
  return { map, missing };
}

/** Excel/Sheets serial date (days since 1899-12-30) → Date. Sheets returns
 * numeric serials for date cells when read with
 * valueRenderOption=UNFORMATTED_VALUE (used by fetchSheetValues). */
function serialDateToDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 86400000);
}

// Some real sheets (confirmed live) repeat their summary/totals block
// periodically throughout the data — not just once above the real header —
// e.g. every ~200 rows, whenever the setter copy-pasted the template again.
// Those rows have no real per-lead date, just plain running-total numbers
// (e.g. 119 = "conexiones aceptadas so far"), which parseLeadDate would
// otherwise happily convert as a Sheets serial into a bogus date near the
// 1899-12-30 epoch — no fixed row position or column-content check can catch
// this reliably, but a real lead submission date is never actually outside
// this range, so anything that lands outside it is treated as not-a-date
// (skipped) rather than silently corrupting a week bucket.
const MIN_PLAUSIBLE_YEAR = 2015;
const MAX_PLAUSIBLE_YEAR = 2100;

function isPlausibleLeadDate(date: Date): boolean {
  const year = date.getUTCFullYear();
  return year >= MIN_PLAUSIBLE_YEAR && year <= MAX_PLAUSIBLE_YEAR;
}

function parseLeadDate(raw: string | undefined): Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && !String(raw).includes("/") && !String(raw).includes("-")) {
    const date = serialDateToDate(asNumber);
    return isPlausibleLeadDate(date) ? date : null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return isPlausibleLeadDate(parsed) ? parsed : null;
}

function periodMonthOf(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** "Semana N del mes" — the sheet has no week column, only a real date per
 * lead, so week-of-month is derived by splitting the month into 4 chunks of
 * ~7 days (day 1-7 → week 1, ... day 22-31 → week 4). This is a defensible
 * default for "Semana 1/2/3/4", not calendar ISO weeks — easy to change here
 * in one place if the convention turns out to differ in practice. */
function weekOfMonth(date: Date): number {
  const day = date.getUTCDate();
  return Math.min(4, Math.ceil(day / 7));
}

function emptyBucket(periodMonth: string, weekNumber: number): Omit<KpiWeekBucket, "sourceRowHash"> {
  return {
    periodMonth,
    weekNumber,
    conexion: 0,
    conexionesAceptadas: 0,
    respuestasPrimerMensaje: 0,
    primerMensajeEnviado: 0,
    enConversacion: 0,
    noLeInteresa: 0,
    seguimientoConversacion: 0,
    seguimientoAgenda: 0,
    agendaManual: 0,
    calificadas: 0,
  };
}

/** The real sheet (confirmed with the user) isn't a plain "row 0 = header"
 * table — rows 1-3 are a separate summary block (its own header + a totals
 * row, e.g. "conexion" / 200), and the actual per-lead detail table's header
 * only starts a few rows down (row 5 in the confirmed layout). Scanning for
 * a fixed row index would be a real, fragile assumption ("no asumir
 * posiciones fijas" applies here too, not just to column order) — instead,
 * scan the first N rows and pick whichever one matches the most
 * REQUIRED_KEYS aliases. This is what caught a real bug: without it, row 0
 * (the summary block's own header, which happens to reuse several of the
 * same words) silently "matched" instead of the real detail-table header,
 * so every lead row was parsed against the wrong column indices. */
function findHeaderRowIndex(values: string[][]): number {
  const SCAN_LIMIT = Math.min(values.length, 20);
  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < SCAN_LIMIT; i++) {
    const { map } = buildColumnMap(values[i]);
    const score = Object.keys(map).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Parses raw Sheets `values.get` output into per-(month, week) aggregated
 * buckets, replicating the setter's own confirmed COUNTIF semantics:
 * - conexion = count of rows with a valid FECHA DE SOLICITUD (matches their
 *   own `=CONTAR(...)` formula over the date column).
 * - conexionesAceptadas = CONEXION column == "Aceptada".
 * - respuestasPrimerMensaje = RESPUESTA AL 1ER MENSAJE == "Si".
 * - primerMensajeEnviado = MENSAJE 1 ENVIADO == "Enviado".
 * - enConversacion / noLeInteresa / agendaManual = ESTADO DEL LEAD ==
 *   "Conversación" / "No le Interesa" / "Agenda Manual" respectively.
 * - calificadas = CITA CALIFICADA == "Calificada" (vs. "No calificada").
 * - seguimientoConversacion = EN SEGUIMIENTO DE LA CONVERSACION == "Enviado".
 * - seguimientoAgenda = EN SEGUIMIENTO DE LA AGENDA == "Enviado" or
 *   "Respondio" (either counts, confirmed both are valid "yes" states).
 */
export function parseKpiSheet(values: string[][]): SyncParseResult {
  const warnings: string[] = [];
  if (values.length === 0) {
    return { buckets: [], skippedRows: 0, columnMap: {}, warnings: ["La hoja está vacía."] };
  }

  const headerIndex = findHeaderRowIndex(values);
  const headerRow = values[headerIndex];
  const dataRows = values.slice(headerIndex + 1);
  const { map, missing } = buildColumnMap(headerRow);
  if (missing.length > 0) {
    warnings.push(`Columnas no encontradas en el encabezado (fila ${headerIndex + 1}): ${missing.join(", ")}.`);
  }

  const buckets = new Map<string, Omit<KpiWeekBucket, "sourceRowHash"> & { rowHashes: string[] }>();
  let skippedRows = 0;

  for (const raw of dataRows) {
    if (raw.every((cell) => !cell || String(cell).trim() === "")) continue; // blank row

    const date = parseLeadDate(raw[map.fecha]);
    if (!date) {
      skippedRows += 1;
      continue;
    }

    const periodMonth = periodMonthOf(date);
    const weekNumber = weekOfMonth(date);
    const key = `${periodMonth}|${weekNumber}`;
    const bucket = buckets.get(key) ?? { ...emptyBucket(periodMonth, weekNumber), rowHashes: [] };

    bucket.conexion += 1; // matches =CONTAR(fecha column) — one lead = one connection.
    if (normalizeValue(raw[map.conexionStatus]) === "aceptada") bucket.conexionesAceptadas += 1;
    if (normalizeValue(raw[map.respuestaPrimerMensaje]) === "si") bucket.respuestasPrimerMensaje += 1;
    if (normalizeValue(raw[map.mensajeEnviado]) === "enviado") bucket.primerMensajeEnviado += 1;

    const estado = normalizeValue(raw[map.estadoLead]);
    if (estado === "conversacion") bucket.enConversacion += 1;
    else if (estado === "no le interesa") bucket.noLeInteresa += 1;
    else if (estado === "agenda manual") bucket.agendaManual += 1;

    if (normalizeValue(raw[map.citaCalificada]) === "calificada") bucket.calificadas += 1;
    if (normalizeValue(raw[map.seguimientoConversacion]) === "enviado") bucket.seguimientoConversacion += 1;
    const seguimientoAgendaValue = normalizeValue(raw[map.seguimientoAgenda]);
    if (seguimientoAgendaValue === "enviado" || seguimientoAgendaValue === "respondio") bucket.seguimientoAgenda += 1;

    bucket.rowHashes.push(createHash("sha256").update(JSON.stringify(raw)).digest("hex"));
    buckets.set(key, bucket);
  }

  const result: KpiWeekBucket[] = [...buckets.values()].map(({ rowHashes, ...bucket }) => ({
    ...bucket,
    sourceRowHash: createHash("sha256").update(rowHashes.join("|")).digest("hex"),
  }));

  return { buckets: result, skippedRows, columnMap: map, warnings };
}
