/** Cálculo determinístico de la Fase 11 (Análisis IA) — código normal, sin
 * IA. La IA (suggestions.ts) solo redacta texto sobre estos resultados ya
 * calculados; la decisión de que existe una oportunidad Y de qué campo del
 * agente toca (`field`) es 100% de este archivo, nunca del modelo — mismo
 * criterio ya firme en el proyecto (kpis/aiManager/analysis.ts,
 * goals/aiRecommendation.ts, policies/aiAnalysis.ts). Todo puro, sin fetch,
 * opera sobre agregados ya traídos por el caller (src/lib/ai-agents/suggestions.ts). */

import type { AgentMetrics } from "./queries";

export interface ToolCallStat {
  toolId: string;
  toolName: string;
  totalCalls: number;
  executedCount: number;
  failedCount: number;
  avgLatencyMs: number | null;
}

export type ReferralStatus = "nuevo" | "contactado" | "interesado" | "no_interesado" | "convertido";

export interface ReferralStats {
  total: number;
  byStatus: Record<ReferralStatus, number>;
}

export interface AgentFinding {
  id: string;
  kind: "strength" | "opportunity" | "pattern";
  field: "rules" | "tools" | "prompt" | null;
  /** Datos reales, en texto plano, para que la IA redacte sobre ellos —
   * nunca un número que la IA tenga que inventar o recalcular. */
  contextLines: string[];
  toolId?: string;
  toolName?: string;
}

const MIN_TOOL_CALLS_FOR_SIGNAL = 3;
const FAILING_TOOL_THRESHOLD_PCT = 30;
const MIN_REFERRALS_FOR_SIGNAL = 5;
const LOW_CONVERSION_THRESHOLD_PCT = 15;
const SEVERE_CONVERSION_THRESHOLD_PCT = 10;
const HIGH_CONVERSION_THRESHOLD_PCT = 40;
const STALLED_REFERRAL_THRESHOLD_PCT = 50;
const SLOW_RESPONSE_MS = 8000;
const FAST_RESPONSE_MS = 3000;

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

/** Herramientas que fallan seguido → oportunidad de revisar/desactivar
 * (field: 'tools'). Requiere volumen mínimo para no marcar como "falla" una
 * herramienta usada 1-2 veces. */
export function detectFailingTools(toolStats: ToolCallStat[]): AgentFinding[] {
  return toolStats
    .filter((t) => t.totalCalls >= MIN_TOOL_CALLS_FOR_SIGNAL && pct(t.failedCount, t.totalCalls) >= FAILING_TOOL_THRESHOLD_PCT)
    .map((t) => ({
      id: `failing-tool-${t.toolId}`,
      kind: "opportunity" as const,
      field: "tools" as const,
      toolId: t.toolId,
      toolName: t.toolName,
      contextLines: [
        `Herramienta: ${t.toolName}`,
        `${t.failedCount} de ${t.totalCalls} llamadas fallaron (${pct(t.failedCount, t.totalCalls)}%).`,
        t.avgLatencyMs !== null ? `Latencia media: ${t.avgLatencyMs}ms.` : "Sin datos de latencia.",
      ],
    }));
}

/** Conversión de referidos de este agente — 3 niveles: severa (<10%, campo
 * prompt: el problema probablemente no es una regla suelta), moderada
 * (10-15%, campo rules: alcanza con una regla nueva), alta (≥40%, fortaleza).
 * Mutuamente excluyentes, requieren volumen mínimo. */
export function detectLowConversion(stats: ReferralStats): AgentFinding | null {
  if (stats.total < MIN_REFERRALS_FOR_SIGNAL) return null;
  const rate = pct(stats.byStatus.convertido, stats.total);
  if (rate >= LOW_CONVERSION_THRESHOLD_PCT) return null;

  const contextLines = [
    `Conversión de referidos: ${stats.byStatus.convertido} de ${stats.total} (${rate}%).`,
    `Distribución: nuevo ${stats.byStatus.nuevo}, contactado ${stats.byStatus.contactado}, interesado ${stats.byStatus.interesado}, no interesado ${stats.byStatus.no_interesado}.`,
  ];

  if (rate < SEVERE_CONVERSION_THRESHOLD_PCT) {
    return { id: "low-conversion-severe", kind: "opportunity", field: "prompt", contextLines };
  }
  return { id: "low-conversion-moderate", kind: "opportunity", field: "rules", contextLines };
}

export function detectHighConversion(stats: ReferralStats): AgentFinding | null {
  if (stats.total < MIN_REFERRALS_FOR_SIGNAL) return null;
  const rate = pct(stats.byStatus.convertido, stats.total);
  if (rate < HIGH_CONVERSION_THRESHOLD_PCT) return null;
  return {
    id: "high-conversion",
    kind: "strength",
    field: null,
    contextLines: [`Conversión de referidos: ${stats.byStatus.convertido} de ${stats.total} (${rate}%).`],
  };
}

/** Referidos estancados en las primeras etapas — informativo (patrón), no
 * trae un cambio propuesto: no hay una causa determinística única a
 * prescribir solo con este dato. */
export function detectStalledReferrals(stats: ReferralStats): AgentFinding | null {
  if (stats.total < MIN_REFERRALS_FOR_SIGNAL) return null;
  const stalled = stats.byStatus.nuevo + stats.byStatus.contactado;
  const rate = pct(stalled, stats.total);
  if (rate < STALLED_REFERRAL_THRESHOLD_PCT) return null;
  return {
    id: "stalled-referrals",
    kind: "pattern",
    field: null,
    contextLines: [`${stalled} de ${stats.total} referidos (${rate}%) siguen en 'nuevo' o 'contactado', sin avanzar a interesado/no interesado/convertido.`],
  };
}

/** Latencia — informativo (patrón): no hay una causa única identificable
 * (temperatura, largo del prompt, tools encadenadas...) solo con este dato,
 * así que no se prescribe un cambio de campo específico. */
export function detectSlowResponses(metrics: AgentMetrics): AgentFinding | null {
  if (metrics.avgLatencyMs === null || metrics.avgLatencyMs < SLOW_RESPONSE_MS) return null;
  return {
    id: "slow-responses",
    kind: "pattern",
    field: null,
    contextLines: [`Latencia media de respuesta: ${Math.round(metrics.avgLatencyMs / 1000)}s sobre ${metrics.conversationsHandled} conversaciones (últimos 14 días).`],
  };
}

export function detectFastResponses(metrics: AgentMetrics): AgentFinding | null {
  if (metrics.avgLatencyMs === null || metrics.avgLatencyMs >= FAST_RESPONSE_MS || metrics.conversationsHandled < MIN_REFERRALS_FOR_SIGNAL) return null;
  return {
    id: "fast-responses",
    kind: "strength",
    field: null,
    contextLines: [`Latencia media de respuesta: ${Math.round(metrics.avgLatencyMs)}ms sobre ${metrics.conversationsHandled} conversaciones (últimos 14 días).`],
  };
}

export function detectHighToolSuccess(toolStats: ToolCallStat[]): AgentFinding | null {
  const totalCalls = toolStats.reduce((sum, t) => sum + t.totalCalls, 0);
  const totalExecuted = toolStats.reduce((sum, t) => sum + t.executedCount, 0);
  if (totalCalls < MIN_REFERRALS_FOR_SIGNAL) return null;
  const rate = pct(totalExecuted, totalCalls);
  if (rate < 90) return null;
  return {
    id: "high-tool-success",
    kind: "strength",
    field: null,
    contextLines: [`${totalExecuted} de ${totalCalls} llamadas a herramientas se ejecutaron correctamente (${rate}%).`],
  };
}

/** Junta todas las detecciones — máximo razonable para no saturar la
 * pantalla, mismo criterio que aiManager (hasta 4 tarjetas). */
export function buildAgentFindings(metrics: AgentMetrics, toolStats: ToolCallStat[], referralStats: ReferralStats | null): AgentFinding[] {
  const findings: AgentFinding[] = [];
  findings.push(...detectFailingTools(toolStats));
  if (referralStats) {
    const low = detectLowConversion(referralStats);
    if (low) findings.push(low);
    const high = detectHighConversion(referralStats);
    if (high) findings.push(high);
    const stalled = detectStalledReferrals(referralStats);
    if (stalled) findings.push(stalled);
  }
  const slow = detectSlowResponses(metrics);
  if (slow) findings.push(slow);
  const fast = detectFastResponses(metrics);
  if (fast) findings.push(fast);
  const toolSuccess = detectHighToolSuccess(toolStats);
  if (toolSuccess) findings.push(toolSuccess);
  return findings;
}
