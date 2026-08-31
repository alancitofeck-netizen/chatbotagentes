"use client";

import { useEffect } from "react";
import { useOnboarding } from "./OnboardingContext";

/** Auto-arranca un tour la primera vez que el miembro entra a ese módulo
 * (status 'pending' = nunca lo vio) — nunca una segunda vez si ya lo
 * completó u omitió (§30 "no molestar"). El pequeño delay deja que la
 * página termine de asentarse antes de que el spotlight busque su primer
 * target. */
export function useAutoStartTour(tourKey: string) {
  const { getLearningStatus, startTour } = useOnboarding();

  useEffect(() => {
    if (getLearningStatus("tour", tourKey) !== "pending") return;
    const timer = setTimeout(() => startTour(tourKey), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourKey]);
}
