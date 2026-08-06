/** Shared formatting helpers for the CRM board (KPI header, cards, table) — extracted
 * so the same "hace 2 h" / "en 30 min" phrasing already used in dashboard/KpiCards.tsx
 * isn't reimplemented per component.
 *
 * `currency` isn't always a real ISO 4217 code by the time it gets here —
 * it can come straight from an AI PDF extraction (policies/pdfExtraction.ts)
 * or a manual free-text field, and a PDF frequently says something like
 * "M.N." (moneda nacional) instead of "MXN". `Intl.NumberFormat` throws a
 * RangeError for anything it doesn't recognize as a currency code, and
 * since this runs during SSR, an uncaught throw here aborts the whole
 * response mid-stream — the browser shows a generic "page couldn't load"
 * with no indication it was a currency string, not a real crash. Falls
 * back to a plain "<code> <number>" format instead of ever throwing. */
export function formatCurrency(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    const number = new Intl.NumberFormat("es", { maximumFractionDigits: 0 }).format(value);
    return currency ? `${currency} ${number}` : number;
  }
}

export function formatRelativeTime(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return diffMin <= 0 ? (diffMin === 0 ? "ahora" : `hace ${Math.abs(diffMin)} min`) : `en ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return diffH > 0 ? `en ${diffH} h` : `hace ${Math.abs(diffH)} h`;
  const diffDays = Math.round(diffH / 24);
  return diffDays > 0 ? `en ${diffDays} d` : `hace ${Math.abs(diffDays)} d`;
}
