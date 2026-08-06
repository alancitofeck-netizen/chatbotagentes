/** Client-safe — proyección "vas a llegar a la meta" 100% determinística
 * (ritmo real extrapolado linealmente a la fecha objetivo), nunca un
 * puntaje/probabilidad inventado por un modelo. Mismo criterio que
 * collections/insights.ts (priorización de Cobranza). La única IA de este
 * módulo genera texto de recomendación a partir de ESTOS números reales
 * (goals/aiRecommendation.ts), no calcula el número en sí. */

export type PaceStatus = "completed" | "ahead" | "on_track" | "at_risk" | "behind";

export interface GoalProjection {
  progressPct: number;
  paceStatus: PaceStatus;
  /** Valor proyectado al día de vencimiento si el ritmo actual se mantiene igual. */
  projectedValue: number;
  /** Días que faltan (0 si ya venció). */
  daysRemaining: number;
  /** Fecha estimada (YYYY-MM-DD) en la que se alcanzaría el objetivo al ritmo
   * actual — null si al ritmo actual nunca se alcanza dentro de un horizonte
   * razonable (2x la duración del período) o si el período todavía no arrancó. */
  estimatedCompletionDate: string | null;
}

const PACE_LABEL: Record<PaceStatus, string> = {
  completed: "Cumplida",
  ahead: "Vas adelantado",
  on_track: "Vas en ritmo",
  at_risk: "En riesgo",
  behind: "Atrasado",
};

export function paceLabel(status: PaceStatus): string {
  return PACE_LABEL[status];
}

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function computeGoalProjection(currentValue: number, targetValue: number, periodStart: string, periodEnd: string, today: Date = new Date()): GoalProjection {
  const progressPct = targetValue > 0 ? Math.round((currentValue / targetValue) * 100) : 0;
  const start = toDate(periodStart);
  const end = toDate(periodEnd);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const daysElapsed = Math.min(totalDays, Math.max(0, Math.round((now.getTime() - start.getTime()) / 86_400_000) + 1));
  const daysRemaining = Math.max(0, Math.round((end.getTime() - now.getTime()) / 86_400_000));

  if (currentValue >= targetValue) {
    return { progressPct: Math.max(100, progressPct), paceStatus: "completed", projectedValue: currentValue, daysRemaining, estimatedCompletionDate: null };
  }

  // Todavía no arranca el período — no hay ritmo que medir.
  if (daysElapsed <= 0) {
    return { progressPct, paceStatus: "on_track", projectedValue: 0, daysRemaining, estimatedCompletionDate: null };
  }

  const dailyRate = currentValue / daysElapsed;
  const projectedValue = Math.round(dailyRate * totalDays);

  // Ya venció el período y no se llegó.
  if (daysRemaining === 0 && currentValue < targetValue) {
    return { progressPct, paceStatus: "behind", projectedValue, daysRemaining: 0, estimatedCompletionDate: null };
  }

  const expectedProgressPct = (daysElapsed / totalDays) * 100;
  const actualProgressPct = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const delta = actualProgressPct - expectedProgressPct;

  let paceStatus: PaceStatus;
  if (delta >= 5) paceStatus = "ahead";
  else if (delta >= -10) paceStatus = "on_track";
  else if (delta >= -25) paceStatus = "at_risk";
  else paceStatus = "behind";

  let estimatedCompletionDate: string | null = null;
  if (dailyRate > 0) {
    const daysToTarget = Math.ceil((targetValue - currentValue) / dailyRate);
    // Horizonte razonable: el doble de la duración del período — más allá de
    // eso, mostrar una fecha concreta sugeriría más precisión de la que este
    // cálculo lineal realmente tiene.
    if (daysToTarget <= totalDays * 2) {
      const estimated = new Date(start.getTime() + (daysElapsed + daysToTarget) * 86_400_000);
      estimatedCompletionDate = `${estimated.getFullYear()}-${String(estimated.getMonth() + 1).padStart(2, "0")}-${String(estimated.getDate()).padStart(2, "0")}`;
    }
  }

  return { progressPct, paceStatus, projectedValue, daysRemaining, estimatedCompletionDate };
}
