/**
 * Single source of truth for every derived KPI metric — dashboard cards,
 * weekly/monthly tabs, ranking, and charts all call these instead of
 * re-deriving the same formula in different components (which is how
 * "no quiero hacer cálculos manuales" silently breaks in practice: two
 * screens computing the same thing slightly differently).
 */

export interface KpiTotals {
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
}

export const EMPTY_KPI_TOTALS: KpiTotals = {
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

export function totalsFromEntries(entries: KpiTotals[]): KpiTotals {
  return entries.length === 0 ? EMPTY_KPI_TOTALS : sumKpiTotals(entries);
}

export function sumKpiTotals(rows: KpiTotals[]): KpiTotals {
  return rows.reduce(
    (acc, r) => ({
      conexion: acc.conexion + r.conexion,
      conexionesAceptadas: acc.conexionesAceptadas + r.conexionesAceptadas,
      respuestasPrimerMensaje: acc.respuestasPrimerMensaje + r.respuestasPrimerMensaje,
      primerMensajeEnviado: acc.primerMensajeEnviado + r.primerMensajeEnviado,
      enConversacion: acc.enConversacion + r.enConversacion,
      noLeInteresa: acc.noLeInteresa + r.noLeInteresa,
      seguimientoConversacion: acc.seguimientoConversacion + r.seguimientoConversacion,
      seguimientoAgenda: acc.seguimientoAgenda + r.seguimientoAgenda,
      agendaManual: acc.agendaManual + r.agendaManual,
      calificadas: acc.calificadas + r.calificadas,
    }),
    { ...EMPTY_KPI_TOTALS },
  );
}

/** "Agendas" = Seguimiento agenda + Agenda manual — confirmed with the user,
 * the sheet has no literal "Agendas" column. */
export function agendas(totals: Pick<KpiTotals, "seguimientoAgenda" | "agendaManual">): number {
  return totals.seguimientoAgenda + totals.agendaManual;
}

/** Confirmed with the user: conversión = calificadas / conexiones aceptadas
 * (NOT over raw conexión). Returns a 0-100 percentage, rounded to 1 decimal. */
export function conversionRate(totals: Pick<KpiTotals, "calificadas" | "conexionesAceptadas">): number {
  if (totals.conexionesAceptadas === 0) return 0;
  return Math.round((totals.calificadas / totals.conexionesAceptadas) * 1000) / 10;
}

export type EstadoLevel = "excelente" | "bueno" | "regular" | "bajo";

export const ESTADO_LABEL: Record<EstadoLevel, string> = {
  excelente: "Excelente",
  bueno: "Bueno",
  regular: "Regular",
  bajo: "Bajo",
};

/** Performance-level thresholds over conversionRate() — defaults, not
 * hardcoded inline anywhere else, so they're the one place to tune later. */
const ESTADO_THRESHOLDS: { min: number; level: EstadoLevel }[] = [
  { min: 40, level: "excelente" },
  { min: 25, level: "bueno" },
  { min: 10, level: "regular" },
  { min: 0, level: "bajo" },
];

export function estadoLevel(conversion: number): EstadoLevel {
  return ESTADO_THRESHOLDS.find((t) => conversion >= t.min)?.level ?? "bajo";
}

/** % adicionales pedidos para Asesores → Performance (src/lib/kpis/agencyPerformance.ts)
 * — mismo criterio que conversionRate: 0 si el denominador es 0, redondeado
 * a 1 decimal. Documentadas explícitamente porque, a diferencia de
 * conversionRate/agendas, no fueron confirmadas con el usuario contra la
 * hoja real — son las fórmulas que el propio usuario especificó al pedir
 * el apartado Performance. */

/** Acceptance Rate = conexiones aceptadas / conexión. */
export function acceptanceRate(totals: Pick<KpiTotals, "conexionesAceptadas" | "conexion">): number {
  if (totals.conexion === 0) return 0;
  return Math.round((totals.conexionesAceptadas / totals.conexion) * 1000) / 10;
}

/** Response Rate = respuestas al primer mensaje / primer mensaje enviado. */
export function responseRate(totals: Pick<KpiTotals, "respuestasPrimerMensaje" | "primerMensajeEnviado">): number {
  if (totals.primerMensajeEnviado === 0) return 0;
  return Math.round((totals.respuestasPrimerMensaje / totals.primerMensajeEnviado) * 1000) / 10;
}

/** Conversation Rate = en conversación / respuestas al primer mensaje. */
export function conversationRate(totals: Pick<KpiTotals, "enConversacion" | "respuestasPrimerMensaje">): number {
  if (totals.respuestasPrimerMensaje === 0) return 0;
  return Math.round((totals.enConversacion / totals.respuestasPrimerMensaje) * 1000) / 10;
}

/** Booking Rate = agendas / en conversación ("conversaciones" del pedido
 * del usuario mapea al campo real enConversacion). */
export function bookingRate(totals: Pick<KpiTotals, "seguimientoAgenda" | "agendaManual" | "enConversacion">): number {
  if (totals.enConversacion === 0) return 0;
  return Math.round((agendas(totals) / totals.enConversacion) * 1000) / 10;
}
