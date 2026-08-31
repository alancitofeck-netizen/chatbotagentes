"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";
import { useOnboarding } from "./OnboardingContext";

/** Nudge liviano de "primera vez usando X" (§28) — a diferencia de
 * ProductTour, no bloquea la pantalla ni resalta nada: es una tarjeta chica
 * en línea, junto al elemento en cuestión, con "Mostrarme"/"Ahora no". Una
 * vez descartado (cualquiera de las dos opciones) nunca vuelve a molestar a
 * este miembro con esa misma clave (kind='hint' en learning_progress). */
export function ContextualHint({
  hintKey,
  title,
  description,
  onShowMe,
  children,
}: {
  hintKey: string;
  title: string;
  description: string;
  /** Se llama si el usuario elige "Mostrarme" — p. ej. abrir el panel al que se refiere el hint. */
  onShowMe?: () => void;
  children?: ReactNode;
}) {
  const { getLearningStatus, setLearningStatus } = useOnboarding();
  const status = getLearningStatus("hint", hintKey);

  if (status !== "pending") return <>{children}</>;

  function dismiss(nextStatus: "completed" | "skipped") {
    setLearningStatus("hint", hintKey, nextStatus);
  }

  return (
    <div className="flex flex-col gap-2">
      {children}
      <div className="flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 p-3">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{description}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                dismiss("completed");
                onShowMe?.();
              }}
              className="text-xs font-medium text-accent-700 hover:text-accent-800"
            >
              Mostrarme
            </button>
            <button type="button" onClick={() => dismiss("skipped")} className="text-xs font-medium text-neutral-500 hover:text-neutral-700">
              Ahora no
            </button>
          </div>
        </div>
        <button type="button" onClick={() => dismiss("skipped")} aria-label="Cerrar" className="shrink-0 text-neutral-400 hover:text-neutral-600">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
