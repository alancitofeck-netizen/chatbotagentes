"use client";

import { Sparkles } from "lucide-react";
import { useOnboarding } from "./OnboardingContext";

/** Botón global "✨ Ayuda" (§26) — vive en Navbar.tsx, junto a Notificaciones,
 * misma posición discreta y consistente en toda la app. */
export function HelpCenterButton() {
  const { openHelpCenter } = useOnboarding();
  return (
    <button
      type="button"
      onClick={openHelpCenter}
      title="Ayuda"
      aria-label="Ayuda"
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
    >
      <Sparkles size={17} aria-hidden="true" />
    </button>
  );
}
