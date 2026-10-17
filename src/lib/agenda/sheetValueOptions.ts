import type { EstadoCita } from "./queries";

/** Paso 3 del panel "Conectar hoja de agendas" (equivalencias): a qué valor del CRM corresponde
 * cada texto que aparece en las columnas ESTADO / PRODUCTO / TIPO DE CITA de la hoja. Archivo sin
 * "server-only" a propósito — lo usan el panel (cliente) y el runner (servidor). */

export type EquivalenceKind = "estado" | "producto" | "appointmentType";

export const PRODUCTO_OPTIONS = ["Gastos Médicos", "Vida", "PPR", "Retiro", "Ahorro", "Educación", "Inversión", "Auto", "Hogar", "Accidentes", "Otro"];

export const TIPO_CITA_OPTIONS = ["1ª reunión", "2ª reunión", "3ª reunión", "Seguimiento", "Cierre", "Entrega de póliza", "Otro"];

export const ESTADO_VALUES: EstadoCita[] = ["agendada", "confirmada", "realizada", "no_show", "cancelada", "propuesta", "venta"];

export function normalizeSheetText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ªº ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ESTADO_ALIASES: Record<string, EstadoCita> = {
  agendada: "agendada",
  agendado: "agendada",
  agenda: "agendada",
  pendiente: "agendada",
  confirmada: "confirmada",
  confirmado: "confirmada",
  confirmo: "confirmada",
  realizada: "realizada",
  realizado: "realizada",
  asistio: "realizada",
  asistida: "realizada",
  hecha: "realizada",
  "no show": "no_show",
  noshow: "no_show",
  "no asistio": "no_show",
  "no se presento": "no_show",
  cancelada: "cancelada",
  cancelado: "cancelada",
  cancelo: "cancelada",
  reagendar: "cancelada",
  propuesta: "propuesta",
  "propuesta enviada": "propuesta",
  cotizacion: "propuesta",
  cotizado: "propuesta",
  venta: "venta",
  vendido: "venta",
  vendida: "venta",
  cliente: "venta",
  cerrado: "venta",
  cerrada: "venta",
};

const PRODUCTO_ALIASES: Record<string, string> = {
  gmm: "Gastos Médicos",
  "gastos medicos": "Gastos Médicos",
  "gastos medicos mayores": "Gastos Médicos",
  salud: "Gastos Médicos",
  vida: "Vida",
  "seguro de vida": "Vida",
  "vida mujer": "Vida",
  ppr: "PPR",
  "plan personal de retiro": "PPR",
  retiro: "Retiro",
  ahorro: "Ahorro",
  educacion: "Educación",
  educativo: "Educación",
  universidad: "Educación",
  inversion: "Inversión",
  inversiones: "Inversión",
  auto: "Auto",
  autos: "Auto",
  hogar: "Hogar",
  casa: "Hogar",
  accidentes: "Accidentes",
  "accidentes personales": "Accidentes",
};

function suggestTipoCita(normalized: string): string | null {
  const ordinal = normalized.match(/^(1|2|3|primer|primera|segunda|segundo|tercera|tercer)\s*(er|era|ra|da|do|ro|a|ª|º)?\s*(reunion|cita|llamada)?$/);
  if (ordinal && ordinal[3]) {
    const n = ordinal[1];
    if (n === "1" || n.startsWith("primer")) return "1ª reunión";
    if (n === "2" || n.startsWith("segund")) return "2ª reunión";
    return "3ª reunión";
  }
  if (/seguimiento/.test(normalized)) return "Seguimiento";
  if (/cierre/.test(normalized)) return "Cierre";
  if (/entrega/.test(normalized)) return "Entrega de póliza";
  return TIPO_CITA_OPTIONS.find((o) => normalizeSheetText(o) === normalized) ?? null;
}

/** Valor del CRM sugerido para un texto de la hoja, o null si no hay una sugerencia segura
 * (el usuario lo elige a mano; si no elige nada, se guarda el texto tal cual de la hoja). */
export function suggestEquivalence(kind: EquivalenceKind, raw: string): string | null {
  const normalized = normalizeSheetText(raw);
  if (!normalized) return null;
  if (kind === "estado") return ESTADO_ALIASES[normalized] ?? null;
  if (kind === "producto") return PRODUCTO_ALIASES[normalized] ?? PRODUCTO_OPTIONS.find((o) => normalizeSheetText(o) === normalized) ?? null;
  return suggestTipoCita(normalized);
}

export type ValueMap = Partial<Record<EquivalenceKind, Record<string, string>>>;

/** Lo que el runner guarda para un texto de la hoja: la equivalencia elegida, o la sugerencia
 * automática, o (producto/tipo) el texto tal cual. Para estado, sin equivalencia → "agendada". */
export function resolveEquivalence(kind: EquivalenceKind, raw: string | undefined, valueMap: ValueMap): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const chosen = valueMap[kind]?.[value];
  if (chosen) return chosen;
  const suggested = suggestEquivalence(kind, value);
  if (kind === "estado") return suggested ?? "agendada";
  return suggested ?? value;
}

/** Inverso, para escribir el estado de vuelta en la hoja: el primer texto de la hoja que el
 * usuario mapeó a ese estado (así la hoja conserva su propio vocabulario), o la etiqueta del CRM. */
export function sheetTextForEstado(estado: EstadoCita, valueMap: ValueMap, fallbackLabel: string): string {
  const entry = Object.entries(valueMap.estado ?? {}).find(([, crm]) => crm === estado);
  return entry ? entry[0] : fallbackLabel;
}
