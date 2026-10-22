/** Módulo Finanzas (reemplaza a Cobranza): gastos, cobros, calendario y resumen. Archivo sin
 * "server-only" a propósito — lo usan la pantalla (cliente) y las queries (servidor).
 *
 * Un FinanceItem es la vista unificada de dos orígenes:
 *  - "manual": finance_entries (0201) — gastos (herramientas, cursos, otros) y cobros cargados a
 *    mano (asesorías, ventas, pólizas sueltas).
 *  - "policy": policy_payments (0097) — los cobros que se generan desde la pestaña Pagos de cada
 *    póliza. Aparecen en Cobros como categoría "Pólizas"; marcarlos cobrados actualiza la póliza. */

export type FinanceType = "in" | "out";
export type FinanceCategory = "poliza" | "asesoria" | "venta" | "herramienta" | "curso" | "gasto";
export type FinanceRecurrence = "" | "mensual" | "anual";
export type FinanceSource = "manual" | "policy";
export type FinanceStatus = "done" | "late" | "soon" | "pend";

export interface FinanceItem {
  /** `${source}:${id}` — único entre los dos orígenes. */
  key: string;
  id: string;
  source: FinanceSource;
  type: FinanceType;
  cat: FinanceCategory;
  title: string;
  party: string;
  amount: number;
  cur: string;
  /** yyyy-mm-dd (vencimiento). */
  date: string;
  rec: FinanceRecurrence;
  method: string;
  methodDetail: string;
  paid: boolean;
  /** yyyy-mm-dd en que se pagó/cobró. */
  paidDate: string | null;
  notes: string;
  /** Solo cobros de póliza. */
  policyId: string | null;
  contactPhone: string | null;
}

export const FINANCE_CATEGORIES: Record<FinanceCategory, { label: string; type: FinanceType; color: string; icon: string }> = {
  poliza: { label: "Pólizas", type: "in", color: "#1f9d6b", icon: "🛡️" },
  asesoria: { label: "Asesorías", type: "in", color: "#0ea5a5", icon: "💬" },
  venta: { label: "Ventas", type: "in", color: "#3b82f6", icon: "🛒" },
  herramienta: { label: "Herramientas", type: "out", color: "#c2410c", icon: "🧰" },
  curso: { label: "Cursos", type: "out", color: "#a855f7", icon: "🎓" },
  gasto: { label: "Otros gastos", type: "out", color: "#e11d74", icon: "🧾" },
};

export const FINANCE_METHODS = ["Transferencia", "Tarjeta de crédito", "Tarjeta de débito", "Efectivo", "Mercado Pago", "PayPal", "Débito automático", "Otro"];

const METHOD_ICONS: Record<string, string> = {
  Transferencia: "🏦",
  "Tarjeta de crédito": "💳",
  "Tarjeta de débito": "💳",
  Tarjeta: "💳",
  Efectivo: "💵",
  "Mercado Pago": "📱",
  PayPal: "🅿️",
  "Débito automático": "🔁",
  Domiciliación: "🔁",
  Cheque: "🧾",
};
export function methodIcon(method: string): string {
  return METHOD_ICONS[method] ?? "•";
}

export const FINANCE_CURRENCIES = ["MXN", "USD", "ARS"] as const;

/** Tipo de cambio: cuántas unidades de cada moneda vale 1 USD. Editable por cuenta. */
export type FinanceRates = Record<string, number>;
export const DEFAULT_FINANCE_RATES: FinanceRates = { USD: 1, MXN: 18.5, ARS: 1200 };

export interface FinanceSettings {
  baseCurrency: string;
  rates: FinanceRates;
}

/** Monto convertido a la moneda de los totales. Una moneda sin tipo de cambio cargado se toma
 * 1 a 1 con USD (nunca rompe un total). */
export function toBase(amount: number, cur: string, settings: FinanceSettings): number {
  const from = settings.rates[cur] || 1;
  const to = settings.rates[settings.baseCurrency] || 1;
  return (amount / from) * to;
}

export function sumBase(items: FinanceItem[], settings: FinanceSettings): number {
  return items.reduce((s, i) => s + toBase(i.amount, i.cur, settings), 0);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 864e5);
}

/** Pagado / vencido / vence en ≤3 días / pendiente — mismo criterio que el archivo original. */
export function financeStatus(item: FinanceItem, todayIso: string): FinanceStatus {
  if (item.paid) return "done";
  const diff = daysBetween(todayIso, item.date);
  if (diff < 0) return "late";
  return diff <= 3 ? "soon" : "pend";
}

export function statusLabel(item: FinanceItem, status: FinanceStatus): string {
  if (status === "done") return item.type === "in" ? "Cobrado" : "Pagado";
  if (status === "late") return "Vencido";
  return status === "soon" ? "Pronto" : "Pendiente";
}

export function sameMonth(iso: string, month: Date): boolean {
  const d = parseIsoDate(iso);
  return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
}

/** Próximo vencimiento de un movimiento recurrente (al marcarlo pagado se crea el siguiente).
 * Fin de mes: el 31 de enero pasa al 28/29 de febrero, no al 3 de marzo. */
export function nextRecurrenceDate(iso: string, rec: FinanceRecurrence): string | null {
  if (!rec) return null;
  const d = parseIsoDate(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear() + (rec === "anual" ? 1 : 0), d.getMonth() + (rec === "mensual" ? 1 : 0), 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return isoDate(target);
}

export function formatMoney(n: number, cur: string): string {
  return `${Math.round(n).toLocaleString("es-MX")} ${cur}`;
}

/** Recordatorio de cobro por WhatsApp (botón del archivo original). Con el teléfono del cliente
 * de la póliza abre su chat directo; si no, wa.me sin destinatario. */
export function whatsappReminderUrl(item: FinanceItem): string {
  const first = item.party.trim().split(/\s+/)[0] || "";
  const date = parseIsoDate(item.date).toLocaleDateString("es-MX");
  const msg = `Hola${first ? " " + first : ""}, te recuerdo que el pago de "${item.title}" por ${formatMoney(item.amount, item.cur)} vence el ${date}. ¿Te paso los datos para transferir?`;
  const digits = (item.contactPhone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
