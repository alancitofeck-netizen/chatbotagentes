import { ONBOARDING_STEPS, type OnboardingStepKey, type OnboardingStatus, type LearningStatus } from "./types";
import { ALL_TOURS } from "@/lib/tours/registry";

export interface LearningStats {
  /** 0-100, redondeado. */
  pct: number;
  completedCount: number;
  /** "pending" + "in_progress" — todavía queda algo por hacer. */
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
  let skippedCount = 0;

  for (const key of ONBOARDING_STEPS) {
    const status = steps[key];
    if (status === "completed") completedCount++;
    else if (status === "skipped") skippedCount++;
  }
  for (const tour of ALL_TOURS) {
    const status = getLearningStatus("tour", tour.key);
    if (status === "completed") completedCount++;
    else if (status === "skipped") skippedCount++;
  }

  const totalCount = ONBOARDING_STEPS.length + ALL_TOURS.length;
  const doneCount = completedCount + skippedCount;
  const pendingCount = totalCount - doneCount;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return { pct, completedCount, pendingCount, skippedCount, totalCount, isComplete: pendingCount === 0 };
}
