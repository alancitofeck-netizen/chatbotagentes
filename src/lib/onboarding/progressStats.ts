import { ONBOARDING_STEPS, type OnboardingStepKey, type OnboardingStatus, type LearningStatus } from "./types";
import { ALL_TOURS } from "@/lib/tours/registry";

export interface LearningStats {
  /** 0-100, redondeado. */
  pct: number;
  completedCount: number;
  inProgressCount: number;
  /** Pendiente puro — NO incluye "in_progress" (ver inProgressCount aparte,
   * ambos se muestran como filtros/contadores distintos en el panel y en
   * la tarjeta del Dashboard). */
  pendingCount: number;
  skippedCount: number;
  totalCount: number;
  /** true solo cuando no queda ningún pending/in_progress — completado u
   * omitido cuentan como "resuelto" (§7 del pedido: omitir no es
   * aprender, pero sí resuelve el paso dentro del onboarding). */
  isComplete: boolean;
}

/** Única fuente de verdad para "cuánto aprendiste" — usado por
 * `LearningProgress` (el detalle completo) y `DashboardLearningCard` (el
 * resumen visible en el Dashboard), para que nunca muestren números
 * distintos. Combina el checklist inicial de 6 pasos con TODOS los tours
 * de módulo ya registrados (`ALL_TOURS`, crece solo a medida que se suman
 * módulos nuevos al registro — nunca un número inventado). */
export function computeLearningStats(
  steps: Record<OnboardingStepKey, OnboardingStatus>,
  getLearningStatus: (kind: "tour", itemKey: string) => LearningStatus,
): LearningStats {
  let completedCount = 0;
  let inProgressCount = 0;
  let skippedCount = 0;

  for (const key of ONBOARDING_STEPS) {
    const status = steps[key];
    if (status === "completed") completedCount++;
    else if (status === "in_progress") inProgressCount++;
    else if (status === "skipped") skippedCount++;
  }
  for (const tour of ALL_TOURS) {
    const status = getLearningStatus("tour", tour.key);
    if (status === "completed") completedCount++;
    else if (status === "in_progress") inProgressCount++;
    else if (status === "skipped") skippedCount++;
  }

  const totalCount = ONBOARDING_STEPS.length + ALL_TOURS.length;
  const pendingCount = totalCount - completedCount - inProgressCount - skippedCount;
  const doneCount = completedCount + skippedCount;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return { pct, completedCount, inProgressCount, pendingCount, skippedCount, totalCount, isComplete: pendingCount === 0 && inProgressCount === 0 };
}
