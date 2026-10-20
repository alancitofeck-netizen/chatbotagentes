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

/** Solo para mostrar en pantalla — nunca escribe nada de vuelta en la hoja ni en la fila del
 * contacto. "ELDA LAMBARRIA" → "Elda Lambarria"; respeta nombres ya mixtos (no fuerza minúsculas
 * en el resto si ya venían bien capitalizados desde la hoja). */
export function titleCaseName(name: string): string {
  if (name !== name.toUpperCase()) return name; // ya tiene mayúsculas/minúsculas mezcladas, no tocar
  return name
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => (part.trim() ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");
}

/** Solo para mostrar en pantalla — el valor guardado (E.164 sin espacios) no cambia. Formatea
 * "5216572569287" (MX, con el "1" de WhatsApp) como "+52 1 657 256 9287"; si no matchea un patrón
 * conocido, devuelve el número tal cual (con el "+" si no lo tenía) en vez de inventar grupos. */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const mx = digits.match(/^52(1)?(\d{10})$/);
  if (mx) {
    const [, one, rest] = mx;
    return `+52${one ? " 1" : ""} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/** Busca un email dentro de un texto libre (p. ej. una nota donde alguien pegó el email a mano) —
 * solo para mostrarlo en pantalla cuando la columna Email está vacía; nunca modifica la nota ni la
 * hoja. `null` si no encuentra nada con forma de email. */
export function extractEmailFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
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
