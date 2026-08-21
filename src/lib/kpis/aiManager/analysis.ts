/** Cálculo determinístico del AI Manager (Asesores → Performance) — código
 * normal, sin IA. La IA (aiManager/actions.ts) solo redacta texto sobre
 * estos resultados ya calculados, nunca decide un número — mismo criterio
 * ya firme en el proyecto (goals/aiRecommendation.ts, collections/
 * policies/aiAnalysis.ts). Todo puro, sin fetch, opera sobre KpiTotals ya
 * agregados por el caller (src/lib/kpis/agencyPerformance.ts). */

import { agendas, conversionRate, acceptanceRate, responseRate, conversationRate, bookingRate, type KpiTotals } from "@/lib/kpis/formulas";
import { deltaPct } from "@/lib/clients/statsHelpers";

export interface FunnelStage {
  key: string;
  label: string;
  rate: number;
}

/** Etapas del funnel en orden — "Aceptada → Calificada" (conversionRate) es
 * el resultado final, no una etapa intermedia, así que se excluye de la
 * detección de cuello de botella (ver detectFunnelBottleneck). */
export function buildFunnelStages(t: KpiTotals): FunnelStage[] {
  const primerMensajeRate = t.conexionesAceptadas === 0 ? 0 : Math.round((t.primerMensajeEnviado / t.conexionesAceptadas) * 1000) / 10;
  return [
    { key: "aceptada", label: "Conexión → Aceptada", rate: acceptanceRate(t) },
    { key: "primerMensaje", label: "Aceptada → Primer mensaje enviado", rate: primerMensajeRate },
    { key: "respuesta", label: "Primer mensaje → Respuesta", rate: responseRate(t) },
    { key: "conversacion", label: "Respuesta → Conversación", rate: conversationRate(t) },
    { key: "agenda", label: "Conversación → Agenda", rate: bookingRate(t) },
    { key: "calificada", label: "Aceptada → Calificada", rate: conversionRate(t) },
  ];
}

export interface Bottleneck {
  label: string;
  rate: number;
}

/** La etapa del funnel con la tasa MÁS BAJA — no "la mayor caída absoluta"
 * (cada etapa parte de una base distinta, comparar caídas absolutas entre
 * etapas de naturaleza distinta no es válido). Excluye "Aceptada →
 * Calificada" (resultado final, no un paso intermedio a señalar) y
 * requiere volumen mínimo (conexionesAceptadas > 0) para no marcar como
 * "cuello de botella" una etapa sin datos suficientes. */
export function detectFunnelBottleneck(t: KpiTotals): Bottleneck | null {
  if (t.conexionesAceptadas === 0) return null;
  const stages = buildFunnelStages(t).filter((s) => s.key !== "calificada");
  const worst = stages.reduce((min, s) => (s.rate < min.rate ? s : min), stages[0]);
  return { label: worst.label, rate: worst.rate };
}

export interface MetricComparison {
  metricLabel: string;
  setterValue: number;
  teamAverage: number;
  diffPct: number | null;
}

const RATE_METRICS: { label: string; pick: (t: KpiTotals) => number }[] = [
  { label: "Acceptance Rate", pick: acceptanceRate },
  { label: "Response Rate", pick: responseRate },
  { label: "Conversation Rate", pick: conversationRate },
  { label: "Booking Rate", pick: bookingRate },
  { label: "Calif. Rate", pick: conversionRate },
];

/** Diferencia % de cada tasa del setter vs. la tasa agregada del equipo
 * completo (no un promedio simple de promedios — la tasa del equipo se
 * calcula sobre la suma total, mismo criterio que el resto del módulo). */
export function compareToTeamAverage(setterTotals: KpiTotals, teamTotals: KpiTotals): MetricComparison[] {
  return RATE_METRICS.map((m) => {
    const setterValue = m.pick(setterTotals);
    const teamAverage = m.pick(teamTotals);
    return { metricLabel: m.label, setterValue, teamAverage, diffPct: deltaPct(setterValue, teamAverage) };
  });
}

export interface PeriodAnomaly {
  metricLabel: string;
  currentValue: number;
  previousValue: number;
  deltaPct: number;
  severity: "info" | "warning";
}

const VOLUME_METRICS: { key: keyof KpiTotals; label: string }[] = [
  { key: "conexion", label: "Conexiones" },
  { key: "conexionesAceptadas", label: "Conexiones aceptadas" },
  { key: "respuestasPrimerMensaje", label: "Respuestas al primer mensaje" },
  { key: "calificadas", label: "Calificadas" },
];

/** Caídas significativas (default: -20% o más) vs. el período anterior —
 * "warning" a partir de -35%, "info" entre -20% y -35%. Umbrales elegidos
 * para no generar ruido con variaciones normales semana a semana; ajustable
 * en un solo lugar. */
export function detectPeriodAnomalies(current: KpiTotals, previous: KpiTotals, thresholdPct = 20): PeriodAnomaly[] {
  const anomalies: PeriodAnomaly[] = [];
  const checks: { label: string; currentValue: number; previousValue: number }[] = [
    ...VOLUME_METRICS.map((m) => ({ label: m.label, currentValue: current[m.key], previousValue: previous[m.key] })),
    { label: "Agendas", currentValue: agendas(current), previousValue: agendas(previous) },
  ];
  for (const c of checks) {
    const pct = deltaPct(c.currentValue, c.previousValue);
    if (pct !== null && pct <= -thresholdPct) {
      anomalies.push({ metricLabel: c.label, currentValue: c.currentValue, previousValue: c.previousValue, deltaPct: pct, severity: pct <= -35 ? "warning" : "info" });
    }
  }
  return anomalies;
}

export type RendimientoStatus = "bueno" | "atencion" | "bajo";

export const RENDIMIENTO_LABEL: Record<RendimientoStatus, string> = { bueno: "Buen rendimiento", atencion: "Atención", bajo: "Bajo rendimiento" };

/** Combina VARIAS métricas vs. el promedio del equipo, nunca una sola:
 * 3+ tasas significativamente por debajo (≤-15%) → bajo rendimiento; 1-2
 * por debajo sin ninguna por encima que compense → atención; el resto →
 * buen rendimiento. Umbral de "significativo" (15%) documentado acá, único
 * lugar a ajustar. */
export function determineRendimiento(setterTotals: KpiTotals, teamTotals: KpiTotals): RendimientoStatus {
  const comparisons = compareToTeamAverage(setterTotals, teamTotals);
  const belowCount = comparisons.filter((c) => c.diffPct !== null && c.diffPct <= -15).length;
  const aboveCount = comparisons.filter((c) => c.diffPct !== null && c.diffPct >= 15).length;
  if (belowCount >= 3) return "bajo";
  if (belowCount >= 1 && aboveCount === 0) return "atencion";
  return "bueno";
}
