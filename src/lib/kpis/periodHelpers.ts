/** Helpers puros de período para Asesores → Performance — sin "server-only"
 * a propósito: los usa tanto la capa de datos (agencyPerformance.ts) como
 * los componentes cliente (navegación de semana/mes en los filtros). */

import type { AgencyKpiEntryRow } from "./agencyPerformance";

/** día 1-7→semana 1, 8-14→2, 15-21→3, 22-31→4 — MISMA convención que ya usa
 * el sync real (weekOfMonth, src/lib/kpis/sync.ts), no una semana ISO
 * calendario. Reimplementada acá (sync.ts es server-only y trabaja sobre el
 * valor de fecha de la hoja) porque esta necesita correr también client-side
 * para la navegación de "semana actual"/"semana anterior" en los filtros. */
export function weekOfMonth(day: number): number {
  return Math.min(4, Math.ceil(day / 7));
}

export function currentPeriodMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

export function currentWeekNumber(): number {
  return weekOfMonth(new Date().getDate());
}

/** Mes anterior/siguiente en formato ISO primer-día-de-mes, a partir de uno dado. */
export function previousPeriodMonth(periodMonth: string): string {
  const d = new Date(periodMonth);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
}

export function nextPeriodMonth(periodMonth: string): string {
  const d = new Date(periodMonth);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/** Semana anterior/siguiente, cruzando de mes si hace falta (semana 1 →
 * semana 4 del mes anterior, y viceversa). */
export function previousWeek(periodMonth: string, weekNumber: number): { periodMonth: string; weekNumber: number } {
  if (weekNumber > 1) return { periodMonth, weekNumber: weekNumber - 1 };
  return { periodMonth: previousPeriodMonth(periodMonth), weekNumber: 4 };
}

export function nextWeek(periodMonth: string, weekNumber: number): { periodMonth: string; weekNumber: number } {
  if (weekNumber < 4) return { periodMonth, weekNumber: weekNumber + 1 };
  return { periodMonth: nextPeriodMonth(periodMonth), weekNumber: 1 };
}

export function monthLabel(periodMonth: string): string {
  return new Date(periodMonth).toLocaleDateString("es", { month: "long", year: "numeric", timeZone: "UTC" });
}

const WEEK_DAY_RANGES: Record<number, string> = { 1: "1-7", 2: "8-14", 3: "15-21", 4: "22-fin" };

export function weekLabel(periodMonth: string, weekNumber: number): string {
  return `Semana ${weekNumber} (${WEEK_DAY_RANGES[weekNumber]} ${monthLabel(periodMonth)})`;
}

/** Últimos N meses (incluido el actual), ISO primer-día-de-mes, para pedirle
 * a getAgencyKpiEntries de una sola vez todo lo que hace falta para
 * evolución histórica + comparativa mensual sin un segundo round-trip. */
export function lastNMonths(n: number, fromMonth = currentPeriodMonth()): string[] {
  const months: string[] = [fromMonth];
  let cursor = fromMonth;
  for (let i = 1; i < n; i++) {
    cursor = previousPeriodMonth(cursor);
    months.push(cursor);
  }
  return months.reverse();
}

export interface SetterBucket {
  setterName: string;
  advisorWorkspaceId: string;
  advisorName: string;
  teamId: string | null;
  rows: AgencyKpiEntryRow[];
}

export function groupBySetter(entries: AgencyKpiEntryRow[]): Map<string, SetterBucket> {
  const map = new Map<string, SetterBucket>();
  for (const e of entries) {
    const bucket = map.get(e.setterId) ?? { setterName: e.setterName, advisorWorkspaceId: e.advisorWorkspaceId, advisorName: e.advisorName, teamId: e.teamId, rows: [] };
    bucket.rows.push(e);
    map.set(e.setterId, bucket);
  }
  return map;
}
