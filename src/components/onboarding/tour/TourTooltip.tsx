"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { attachFloatingPosition, type FloatingPosition } from "../floatingPosition";
import { prefersReducedMotion } from "./waitForElement";
import type { TourStep } from "@/lib/tours/types";

const ARROW_OFFSET: Record<FloatingPosition["placement"], string> = {
  top: "bottom-[-6px] left-1/2 -translate-x-1/2 rotate-45",
  bottom: "top-[-6px] left-1/2 -translate-x-1/2 rotate-45",
  left: "right-[-6px] top-1/2 -translate-y-1/2 rotate-45",
  right: "left-[-6px] top-1/2 -translate-y-1/2 rotate-45",
};

export function TourTooltip({
  targetEl,
  step,
  stepIndex,
  totalSteps,
  waitingForClick,
  onNext,
  onBack,
  onSkip,
  onClose,
}: {
  targetEl: HTMLElement;
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  waitingForClick: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const floatingRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<FloatingPosition | null>(null);
  const reduced = prefersReducedMotion();

  useLayoutEffect(() => {
    if (!floatingRef.current) return;
    return attachFloatingPosition(targetEl, floatingRef.current, step.placement ?? "bottom", setPos);
  }, [targetEl, step]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      ref={floatingRef}
      role="dialog"
      aria-modal="true"
      className={cn(
        "fixed w-[300px] rounded-lg border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-lg)]",
        !reduced && "transition-opacity duration-[var(--duration-base)]",
        pos ? "opacity-100" : "opacity-0",
      )}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: "var(--z-tour-tooltip)" as unknown as number }}
    >
      {pos && (
        <div
          className={cn("absolute size-3 border-b border-r border-border-default bg-surface-1", ARROW_OFFSET[pos.placement])}
          style={!reduced ? { animation: "gl-tour-arrow-pulse 1.4s ease-in-out infinite" } : undefined}
          aria-hidden="true"
        />
      )}

      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug text-foreground">{step.title}</h3>
        <button type="button" onClick={onClose} aria-label="Cerrar tutorial" className="shrink-0 rounded-md p-0.5 text-neutral-400 hover:bg-surface-2 hover:text-foreground">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="mb-3 text-[13px] leading-relaxed text-neutral-600">{step.description}</p>

      <div className="mb-3 flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= stepIndex ? "bg-accent-500" : "bg-surface-3")} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onSkip} className="text-xs font-medium text-neutral-400 hover:text-neutral-600">
          Omitir tutorial
        </button>
        <div className="flex items-center gap-1.5">
          {stepIndex > 0 && (
            <Button size="sm" variant="ghost" onClick={onBack}>
              <ChevronLeft size={14} aria-hidden="true" />
              Atrás
            </Button>
          )}
          {waitingForClick ? (
            <span className="flex items-center gap-1.5 rounded-md bg-accent-50 px-2.5 py-1.5 text-xs font-medium text-accent-700">
              <MousePointerClick size={14} aria-hidden="true" />
              Hacé clic para continuar
            </span>
          ) : (
            <Button size="sm" onClick={onNext}>
              {stepIndex === totalSteps - 1 ? "Finalizar" : "Siguiente"}
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
