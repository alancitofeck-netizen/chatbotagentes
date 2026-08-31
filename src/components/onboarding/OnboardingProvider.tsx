"use client";

import type { ReactNode } from "react";
import { OnboardingProvider as OnboardingContextProvider, useOnboarding } from "./OnboardingContext";
import { WelcomeOnboardingModal } from "./WelcomeOnboardingModal";
import { ProductTourHost } from "./tour/ProductTourHost";
import { HelpCenterPanel } from "./HelpCenterPanel";
import type { OnboardingState } from "@/lib/onboarding/types";

export { useOnboarding };

/** Punto de montaje único (src/app/(protected)/layout.tsx) — envuelve toda
 * la app protegida y monta el modal de bienvenida, el motor de tours y el
 * panel de Ayuda una sola vez, sin que ningún módulo tenga que preocuparse
 * por dónde viven. En Modo Supervisor (memberId null) no se monta nada de
 * esto — no hay una fila real de workspace_members dueña de progreso. */
export function OnboardingProvider({ initialState, children }: { initialState: OnboardingState; children: ReactNode }) {
  return (
    <OnboardingContextProvider initialState={initialState}>
      {children}
      {initialState.memberId && (
        <>
          <WelcomeOnboardingModal />
          <ProductTourHost />
          <HelpCenterPanel />
        </>
      )}
    </OnboardingContextProvider>
  );
}
