/** Helpers de agregación en JS compartidos por Resumen/Agenda/Operación/KPIs
 * — extraídos de resumen/page.tsx (donde se escribieron primero) para no
 * duplicarlos en cada pestaña nueva. Todos operan sobre fechas/datos ya
 * fetcheados por el caller — ninguno hace una query nueva. */

/** Serie diaria (últimos `days`) para sparklines — cuenta ocurrencias de
 * `dates` por día calendario, terminando hoy. */
export function bucketByDay(dates: string[], days: number): number[] {
  const buckets = new Array(days).fill(0);
  const todayMidnight = new Date(new Date().toDateString());
  for (const iso of dates) {
    const dayMidnight = new Date(new Date(iso).toDateString());
    const diffDays = Math.round((todayMidnight.getTime() - dayMidnight.getTime()) / 86400000);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

/** % este mes vs. mes anterior por CONTEO de fechas — null si el mes
 * anterior no tiene datos para comparar (nunca un "+∞%" sin sentido). */
export function monthOverMonthDelta(dates: string[]): number | null {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = dates.filter((d) => new Date(d) >= thisMonthStart).length;
  const lastMonth = dates.filter((d) => {
    const x = new Date(d);
    return x >= lastMonthStart && x < thisMonthStart;
  }).length;
  return deltaPct(thisMonth, lastMonth);
}

/** Conteo real este-mes/mes-anterior — usado por la tabla "Comparativa
 * mensual" de KPIs, que necesita los números crudos además del % (deltaPct
 * ya calcula el %, pero la tabla también muestra "este mes: X / anterior: Y"). */
export function monthCounts(dates: string[]): { thisMonth: number; lastMonth: number } {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = dates.filter((d) => new Date(d) >= thisMonthStart).length;
  const lastMonth = dates.filter((d) => {
    const x = new Date(d);
    return x >= lastMonthStart && x < thisMonthStart;
  }).length;
  return { thisMonth, lastMonth };
}

/** Igual que `monthCounts` pero sumando un valor numérico (ej. comisión) en
 * vez de contar filas — usado por "Valor generado" en la comparativa mensual. */
export function monthSums(items: { date: string; value: number }[]): { thisMonth: number; lastMonth: number } {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let thisMonth = 0;
  let lastMonth = 0;
  for (const { date, value } of items) {
    const d = new Date(date);
    if (d >= thisMonthStart) thisMonth += value;
    else if (d >= lastMonthStart) lastMonth += value;
  }
  return { thisMonth, lastMonth };
}

/** % entre dos números cualesquiera (no solo conteos de fechas) — mismo
 * helper que ya usa BoardKpis (src/lib/crm/queries.ts) para citas
 * generadas/show rate/pólizas vendidas/valor generado. null si no hay base
 * del período anterior. */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
