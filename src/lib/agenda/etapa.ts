import type { BadgeVariant } from "@/components/ui/Badge";
import type { EstadoCita } from "./queries";

/** "Etapa" del lead — más granular que estado_cita, pensada para decidir de un vistazo qué hacer
 * con cada lead (pedido del rediseño de Agenda → Leads). Hoy la hoja NO tiene una columna "Etapa"
 * real — nada la mapea todavía en el wizard de conexión — así que siempre se CALCULA acá con las
 * 3 reglas pedidas; si en el futuro se agrega y mapea una columna Etapa real, este cálculo pasa a
 * ser solo el fallback para cuando esa celda viene vacía. */
export type Etapa = "sin_resultado" | "agendado" | "segunda_cita" | "propuesta" | "cliente" | "no_calificado" | "perdido";

export const ETAPA_META: Record<Etapa, { label: string; variant: BadgeVariant }> = {
  sin_resultado: { label: "Sin resultado", variant: "warning" },
  agendado: { label: "Agendado", variant: "info" },
  segunda_cita: { label: "Segunda cita", variant: "accent" },
  propuesta: { label: "Propuesta enviada", variant: "info" },
  cliente: { label: "Cliente", variant: "success" },
  no_calificado: { label: "No calificado", variant: "neutral" },
  perdido: { label: "Perdido", variant: "error" },
};

export const ETAPA_TAB_OPTIONS: Etapa[] = ["sin_resultado", "agendado", "segunda_cita", "propuesta", "no_calificado"];

/** Fallback estado_cita → Etapa para la regla 3 ("dejar lo que diga la columna Estado") — no hay
 * una correspondencia 1 a 1 real entre los 6 estados de cita y las 7 etapas (Segunda cita/No
 * calificado no existen como estado_cita, son decisiones del asesor); este mapeo es una lectura
 * razonable, no un dato real — avisado en el reporte final de este cambio. */
const ESTADO_TO_ETAPA_FALLBACK: Record<EstadoCita, Etapa> = {
  agendada: "sin_resultado",
  confirmada: "agendado",
  realizada: "segunda_cita",
  no_show: "perdido",
  cancelada: "perdido",
  propuesta: "propuesta",
  venta: "cliente",
};

/** 1) Cita futura → Agendado. 2) Cita pasada y sigue "Agendada" → Sin resultado. 3) Si no, el
 * estado de la cita más relevante vía el fallback de arriba (o "Sin resultado" sin ninguna cita). */
export function computeEtapa(lead: { nextCitaAt: string | null; lastCitaAt: string | null; lastEstado: EstadoCita | null }): Etapa {
  if (lead.nextCitaAt) return "agendado";
  if (lead.lastCitaAt && lead.lastEstado === "agendada") return "sin_resultado";
  if (lead.lastEstado) return ESTADO_TO_ETAPA_FALLBACK[lead.lastEstado];
  return "sin_resultado";
}
