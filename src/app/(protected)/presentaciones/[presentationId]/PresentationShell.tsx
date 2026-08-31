"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { PresentationDetail } from "@/lib/presentations/queries";
import { PRESENTATION_STEPS, type PresentationStep } from "@/lib/presentations/constants";
import { updatePresentationStepAction } from "@/lib/presentations/actions";
import { InformacionStep } from "./steps/InformacionStep";
import { FotosStep } from "./steps/FotosStep";
import { ServiciosStep } from "./steps/ServiciosStep";
import { IaStep } from "./steps/IaStep";
import { VistaPreviaStep } from "./steps/VistaPreviaStep";
import { FinalizarStep } from "./steps/FinalizarStep";

const SAVE_DEBOUNCE_MS = 1200;
const STEP_ORDER = PRESENTATION_STEPS.map((s) => s.key);

function stepSummary(step: PresentationStep, presentation: PresentationDetail): string | null {
  switch (step) {
    case "informacion": {
      const p = presentation.personalInfo;
      const parts = [p.firstName ? `${p.firstName} ${p.lastName ?? ""}`.trim() : null, p.profession ?? null].filter((v): v is string => Boolean(v));
      return parts.length ? parts.join(" · ") : null;
    }
    case "fotos":
      return presentation.photos.length > 0 ? `${presentation.photos.length} foto(s)` : null;
    case "servicios":
      return presentation.commercialInfo.services ? "Cargado" : null;
    case "ia":
      return presentation.aiContent ? "Contenido generado" : null;
    case "vista_previa":
      return presentation.slides.length ? `${presentation.slides.length} diapositivas` : null;
    case "finalizar":
      return presentation.status === "lista" ? "Lista" : null;
    default:
      return null;
  }
}

function formatSavedLabel(lastSavedAt: Date | null, now: Date): string {
  if (!lastSavedAt) return "Sin cambios todavía";
  const diffSec = Math.max(0, Math.round((now.getTime() - lastSavedAt.getTime()) / 1000));
  if (diffSec < 3) return "Guardado";
  if (diffSec < 60) return `Guardado hace ${diffSec} segundos`;
  const diffMin = Math.round(diffSec / 60);
  return `Guardado hace ${diffMin} min`;
}

export function PresentationShell({ presentation: initialPresentation }: { presentation: PresentationDetail }) {
  const [presentation, setPresentation] = useState(initialPresentation);
  const [activeStep, setActiveStep] = useState<PresentationStep>(initialPresentation.currentStep);
  const [now, setNow] = useState(() => new Date());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Autosave debounced — mismo criterio que AdvisorySessionShell: el
  // cliente manda el objeto acumulado completo cada vez.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      updatePresentationStepAction(presentation.id, {
        title: presentation.title,
        clientLabel: presentation.clientLabel,
        personalInfo: presentation.personalInfo,
        photos: presentation.photos,
        commercialInfo: presentation.commercialInfo,
        slides: presentation.slides,
      })
        .then(() => setLastSavedAt(new Date()))
        .finally(() => setSaving(false));
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation.title, presentation.clientLabel, presentation.personalInfo, presentation.photos, presentation.commercialInfo, presentation.slides]);

  // Transición suave entre pasos — sin cambiar de ruta.
  useEffect(() => {
    Promise.resolve().then(() => setVisible(false));
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [activeStep]);

  function goToStep(step: PresentationStep) {
    setActiveStep(step);
    updatePresentationStepAction(presentation.id, { currentStep: step }).catch(() => {});
  }

  function goNext() {
    const idx = STEP_ORDER.indexOf(activeStep);
    if (idx < STEP_ORDER.length - 1) goToStep(STEP_ORDER[idx + 1]);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      {/* Barra superior */}
      <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">{presentation.title}</h1>
            <Badge variant="info" dot>
              ✨ Crear mi Presentación
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">Wizard con IA para armar tu presentación profesional.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Badge variant={presentation.status === "lista" ? "success" : presentation.status === "generando" ? "warning" : "neutral"}>
            {presentation.status === "lista" ? "Lista" : presentation.status === "generando" ? "Generando…" : "Borrador"}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            {saving && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            {formatSavedLabel(lastSavedAt, now)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Rail de progreso */}
        <div className="flex shrink-0 flex-col gap-2 lg:sticky lg:top-4 lg:w-[280px]" data-tour="presentations.step-rail">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Progreso</p>
          {PRESENTATION_STEPS.map((step, i) => {
            const idx = STEP_ORDER.indexOf(activeStep);
            const status = step.key === activeStep ? "active" : i < idx ? "done" : "pending";
            const summary = stepSummary(step.key, presentation);
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => goToStep(step.key)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-150 ${
                  status === "active"
                    ? "border-accent-500 bg-accent-50"
                    : status === "done"
                      ? "border-border-default bg-surface-1 hover:border-accent-300"
                      : "border-border-default bg-surface-1 opacity-70 hover:opacity-100"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    status === "done" ? "bg-success text-white" : status === "active" ? "border-2 border-accent-500 text-accent-700" : "bg-surface-3 text-neutral-400"
                  }`}
                >
                  {status === "done" ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${status === "active" ? "text-accent-700" : "text-foreground"}`}>{step.label}</span>
                  {summary && <span className="block truncate text-xs text-neutral-500">{summary}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel principal */}
        <div
          className={`min-w-0 flex-1 rounded-lg border border-border-default bg-surface-1 p-5 transition-all duration-300 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          {activeStep === "informacion" && (
            <InformacionStep
              presentationId={presentation.id}
              data={presentation.personalInfo}
              onChange={(personalInfo) => setPresentation((s) => ({ ...s, personalInfo }))}
            />
          )}
          {activeStep === "fotos" && (
            <FotosStep presentationId={presentation.id} photos={presentation.photos} onChange={(photos) => setPresentation((s) => ({ ...s, photos }))} />
          )}
          {activeStep === "servicios" && (
            <ServiciosStep data={presentation.commercialInfo} onChange={(commercialInfo) => setPresentation((s) => ({ ...s, commercialInfo }))} />
          )}
          {activeStep === "ia" && (
            <IaStep
              presentationId={presentation.id}
              hasContent={Boolean(presentation.aiContent)}
              onGenerated={(aiContent, slides) => setPresentation((s) => ({ ...s, aiContent, slides, status: "borrador" }))}
            />
          )}
          {activeStep === "vista_previa" && (
            <VistaPreviaStep slides={presentation.slides} onChange={(slides) => setPresentation((s) => ({ ...s, slides }))} />
          )}
          {activeStep === "finalizar" && (
            <FinalizarStep
              presentation={presentation}
              onFinalized={(shareSlug, pdfStoragePath) => setPresentation((s) => ({ ...s, status: "lista", shareSlug, pdfStoragePath }))}
            />
          )}

          {activeStep !== "finalizar" && (
            <div className="mt-6 flex justify-end border-t border-border-default pt-4">
              <button type="button" onClick={goNext} className="text-sm font-medium text-accent-600 hover:text-accent-700">
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
