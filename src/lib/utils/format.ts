/** Shared formatting helpers for the CRM board (KPI header, cards, table) — extracted
 * so the same "hace 2 h" / "en 30 min" phrasing already used in dashboard/KpiCards.tsx
 * isn't reimplemented per component. */
export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
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
