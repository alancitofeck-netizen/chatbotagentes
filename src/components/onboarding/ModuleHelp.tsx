"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "./OnboardingContext";
import { attachFloatingPosition, type FloatingPosition } from "./floatingPosition";

/** "¿Qué hago acá?" + "Volver a ver tutorial" (§27/§31) — una línea para
 * agregar en el header de cualquier módulo, sin sacar al usuario de la
 * pantalla actual (popover, no navegación ni modal). */
export function ModuleHelp({ description, tourKey }: { description: string; tourKey?: string }) {
  const { startTour } = useOnboarding();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<FloatingPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !floatingRef.current) {
      setPos(null);
      return;
    }
    return attachFloatingPosition(triggerRef.current, floatingRef.current, "bottom", setPos);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || floatingRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-border-default px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-surface-2 hover:text-foreground"
      >
        <HelpCircle size={13} aria-hidden="true" />
        ¿Qué hago acá?
      </button>
      {open &&
        createPortal(
          <div
            ref={floatingRef}
            role="dialog"
            className={cn("fixed w-72 rounded-lg border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-md)]", pos ? "opacity-100" : "opacity-0")}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: "var(--z-tour-tooltip)" as unknown as number }}
          >
            <p className="mb-3 text-[13px] leading-relaxed text-neutral-600">{description}</p>
            {tourKey && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  startTour(tourKey);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700"
              >
                <PlayCircle size={14} aria-hidden="true" />
                Volver a ver tutorial
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
