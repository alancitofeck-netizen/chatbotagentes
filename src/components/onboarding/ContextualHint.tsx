"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "./OnboardingContext";
import { attachFloatingPosition, type FloatingPosition } from "./floatingPosition";

/** Nudge liviano de "primera vez usando X" (§28) — a diferencia de
 * ProductTour, no bloquea la pantalla ni resalta nada: un popover chico
 * flotante, anclado al elemento real (mismo mecanismo de posicionamiento
 * que ModuleHelp/TourTooltip, floating-ui) — nunca un bloque apilado que
 * rompa una fila flex existente (ej. una barra de acciones). "Mostrarme"/
 * "Ahora no" — cualquiera de las dos descarta el hint para siempre para
 * este miembro (kind='hint' en learning_progress), nunca vuelve a
 * molestar. El wrapper alrededor de `children` es un `div` simple —
 * funciona igual envolviendo un botón chico en una fila flex (se ajusta a
 * su contenido, como cualquier item de flexbox) o una Card de ancho
 * completo en una columna flex (hereda el stretch del padre); un
 * `inline-flex` rompía este segundo caso. */
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
  children: ReactNode;
}) {
  const { getLearningStatus, setLearningStatus } = useOnboarding();
  const status = getLearningStatus("hint", hintKey);
  const anchorRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<FloatingPosition | null>(null);
  const open = status === "pending";

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !floatingRef.current) {
      setPos(null);
      return;
    }
    return attachFloatingPosition(anchorRef.current, floatingRef.current, "bottom", setPos);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss("skipped");
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function dismiss(nextStatus: "completed" | "skipped") {
    setLearningStatus("hint", hintKey, nextStatus);
  }

  return (
    <div ref={anchorRef} className="relative">
      {children}
      {open &&
        createPortal(
          <div
            ref={floatingRef}
            role="dialog"
            className={cn(
              "fixed w-[min(280px,calc(100vw-32px))] rounded-lg border border-accent-200 bg-accent-50 p-3 shadow-[var(--elevation-md)]",
              pos ? "opacity-100" : "opacity-0",
            )}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: "var(--z-tour-tooltip)" as unknown as number }}
          >
            <div className="flex items-start gap-2">
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
          </div>,
          document.body,
        )}
    </div>
  );
}
