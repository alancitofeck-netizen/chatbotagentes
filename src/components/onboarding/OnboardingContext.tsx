"use client";

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import type { OnboardingState, OnboardingStepKey, OnboardingStatus, LearningKind, LearningStatus } from "@/lib/onboarding/types";
import { setOnboardingStepAction, markOnboardingSeenAction, setLearningProgressAction, resetAllProgressAction } from "@/lib/onboarding/actions";
import { getTourByKey } from "@/lib/tours/registry";
import type { TourConfig } from "@/lib/tours/types";
import { ONBOARDING_STEPS } from "@/lib/onboarding/types";

interface OnboardingContextValue {
  memberId: string | null;
  steps: Record<OnboardingStepKey, OnboardingStatus>;
  learning: Record<string, LearningStatus>;
  setStepStatus: (step: OnboardingStepKey, status: OnboardingStatus) => void;
  showWelcome: boolean;
  openWelcome: () => void;
  closeWelcome: () => void;
  getLearningStatus: (kind: LearningKind, itemKey: string) => LearningStatus;
  setLearningStatus: (kind: LearningKind, itemKey: string, status: LearningStatus) => void;
  activeTour: TourConfig | null;
  startTour: (tourKey: string) => void;
  closeTour: () => void;
  isHelpCenterOpen: boolean;
  openHelpCenter: () => void;
  closeHelpCenter: () => void;
  /** "Reiniciar tutoriales" (Perfil → Aprendizaje) — vuelve todos los pasos
   * del checklist y todos los tours/hints a 'pending', local e
   * inmediatamente (sin recargar la página). */
  resetAllProgress: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Nunca lanza si no hay provider — módulos que todavía no llaman
 * useOnboarding() (todos salvo CRM/Calendario/Tareas/Classroom en la Fase 1)
 * no deberían tener que preocuparse por esto, y el layout protegido siempre
 * monta el provider igual, así que en la práctica esto solo protege tests/
 * Storybook aislados. */
export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding debe usarse dentro de <OnboardingProvider>");
  return ctx;
}

export function OnboardingProvider({ initialState, children }: { initialState: OnboardingState; children: ReactNode }) {
  const [steps, setSteps] = useState(initialState.steps);
  const [learning, setLearning] = useState(initialState.learning);
  const [showWelcome, setShowWelcome] = useState(initialState.isFirstVisit && initialState.memberId !== null);
  const [activeTourKey, setActiveTourKey] = useState<string | null>(null);
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);

  // Se ejecuta una sola vez, en el primer render de la primera visita real —
  // siembra las 6 filas en 'pending' para que isFirstVisit nunca vuelva a
  // ser true para este miembro (ver markOnboardingSeenAction).
  useEffect(() => {
    if (initialState.isFirstVisit && initialState.memberId) {
      markOnboardingSeenAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStepStatus = useCallback((step: OnboardingStepKey, status: OnboardingStatus) => {
    setSteps((prev) => ({ ...prev, [step]: status }));
    void setOnboardingStepAction(step, status);
  }, []);

  const setLearningStatus = useCallback((kind: LearningKind, itemKey: string, status: LearningStatus) => {
    setLearning((prev) => ({ ...prev, [`${kind}:${itemKey}`]: status }));
    void setLearningProgressAction(kind, itemKey, status);
  }, []);

  const getLearningStatus = useCallback((kind: LearningKind, itemKey: string) => learning[`${kind}:${itemKey}`] ?? "pending", [learning]);

  const resetAllProgress = useCallback(() => {
    setSteps(Object.fromEntries(ONBOARDING_STEPS.map((k) => [k, "pending" as OnboardingStatus])) as Record<OnboardingStepKey, OnboardingStatus>);
    setLearning({});
    void resetAllProgressAction();
  }, []);

  const activeTour = activeTourKey ? (getTourByKey(activeTourKey) ?? null) : null;

  const value = useMemo<OnboardingContextValue>(
    () => ({
      memberId: initialState.memberId,
      steps,
      learning,
      setStepStatus,
      showWelcome,
      openWelcome: () => setShowWelcome(true),
      closeWelcome: () => setShowWelcome(false),
      getLearningStatus,
      setLearningStatus,
      activeTour,
      startTour: (tourKey: string) => setActiveTourKey(tourKey),
      closeTour: () => setActiveTourKey(null),
      isHelpCenterOpen,
      openHelpCenter: () => setIsHelpCenterOpen(true),
      closeHelpCenter: () => setIsHelpCenterOpen(false),
      resetAllProgress,
    }),
    [initialState.memberId, steps, learning, setStepStatus, showWelcome, getLearningStatus, setLearningStatus, activeTour, isHelpCenterOpen, resetAllProgress],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
