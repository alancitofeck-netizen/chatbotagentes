"use client";

import { useEffect, useRef, useState } from "react";
import { useOnboarding } from "../OnboardingContext";
import { toast } from "@/components/toast/toast";
import { waitForElement, prefersReducedMotion } from "./waitForElement";
import { TourSpotlight } from "./TourSpotlight";
import { TourTooltip } from "./TourTooltip";

/** Único punto de montaje del motor de tours — vive dentro de
 * OnboardingProvider (una sola instancia para toda la app). Reacciona a
 * `activeTour` del contexto; cada módulo solo necesita llamar
 * `startTour(key)`, nunca renderiza nada de esto directamente. */
export function ProductTourHost() {
  const { activeTour, closeTour, setLearningStatus } = useOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Reset de stepIndex cuando cambia el tour activo — ajuste de estado
  // durante el render (patrón recomendado por React para "resetear estado
  // cuando cambia una prop"), no un efecto, así nunca dispara el lint de
  // setState síncrono dentro de un efecto.
  const lastTourKeyRef = useRef<string | null>(null);
  if (activeTour?.key !== lastTourKeyRef.current) {
    lastTourKeyRef.current = activeTour?.key ?? null;
    if (stepIndex !== 0) setStepIndex(0);
    if (target !== null) setTarget(null);
    if (rect !== null) setRect(null);
  }

  useEffect(() => {
    if (!activeTour) return;
    const step = activeTour.steps[stepIndex];
    if (!step) {
      // No hay más pasos — se llegó al final. setLearningStatus/closeTour
      // corren dentro del efecto pero no son un setState de ESTE
      // componente, así que no aplica la regla de "setState síncrono".
      setLearningStatus("tour", activeTour.key, "completed");
      if (activeTour.completionTitle) {
        toast.success(activeTour.completionTitle, activeTour.completionDescription);
      }
      closeTour();
      return;
    }

    let cancelled = false;
    waitForElement(step.target).then((el) => {
      if (cancelled) return;
      if (!el) {
        // El elemento nunca apareció (rol distinto, contenido vacío, etc.)
        // — nunca se deja el tour "colgado", se saltea (§30/§37).
        setStepIndex((i) => i + 1);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      setTarget(el);
      setRect(el.getBoundingClientRect());
    });
    return () => {
      cancelled = true;
    };
  }, [activeTour, stepIndex, closeTour, setLearningStatus]);

  // El rect del target puede moverse (scroll, resize, contenido que carga) —
  // se recalcula escuchando scroll/resize mientras haya un target activo.
  useEffect(() => {
    if (!target) return;
    function update() {
      setRect(target!.getBoundingClientRect());
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [target]);

  const step = activeTour?.steps[stepIndex];
  const waitingForClick = Boolean(target && step?.action === "click");

  useEffect(() => {
    if (!target || step?.action !== "click") return;
    function handleClick() {
      setStepIndex((i) => i + 1);
    }
    target.addEventListener("click", handleClick, { once: true });
    return () => target.removeEventListener("click", handleClick);
  }, [target, step]);

  function skip() {
    if (activeTour) setLearningStatus("tour", activeTour.key, "skipped");
    closeTour();
  }

  if (!activeTour || !target || !rect || !step) return null;

  return (
    <>
      <TourSpotlight rect={rect} />
      <TourTooltip
        targetEl={target}
        step={step}
        stepIndex={stepIndex}
        totalSteps={activeTour.steps.length}
        waitingForClick={waitingForClick}
        onNext={() => setStepIndex((i) => i + 1)}
        onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
        onSkip={skip}
        onClose={skip}
      />
    </>
  );
}
