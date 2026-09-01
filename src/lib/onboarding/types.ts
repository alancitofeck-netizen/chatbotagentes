export type OnboardingStepKey = "profile" | "whatsapp" | "manychat" | "calendar" | "crm" | "automations";
export type OnboardingStatus = "pending" | "in_progress" | "completed" | "skipped";

export const ONBOARDING_STEPS: readonly OnboardingStepKey[] = ["profile", "whatsapp", "manychat", "calendar", "crm", "automations"];

/** Pasos cuyo estado se puede derivar de una conexión real ya existente
 * (nunca se confía solo en lo que el miembro haya marcado a mano) — ver
 * getOnboardingState() en queries.ts. */
export const AUTO_DERIVABLE_STEPS: readonly OnboardingStepKey[] = ["manychat", "calendar"];

export type LearningKind = "tour" | "hint" | "module";
/** "in_progress" solo tiene sentido real para kind='tour' (se repite un
 * tour omitido/completado desde "Tu aprendizaje" — ver LearningProgress.tsx)
 * — un hint no tiene "a medias", así que esos siguen usando solo pending/
 * completed/skipped en la práctica, aunque el tipo lo permita para todos. */
export type LearningStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface OnboardingState {
  /** null si el miembro está en Modo Supervisor (no tiene workspace_members real). */
  memberId: string | null;
  steps: Record<OnboardingStepKey, OnboardingStatus>;
  /** true solo la primera vez que este miembro entra (onboarding_progress no tiene ninguna fila todavía) — dispara el modal de bienvenida una sola vez. */
  isFirstVisit: boolean;
  /** clave = `${kind}:${itemKey}` */
  learning: Record<string, LearningStatus>;
}
