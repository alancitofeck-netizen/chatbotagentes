"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, CircleDot, SkipForward, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "./OnboardingContext";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ONBOARDING_STEPS, type OnboardingStepKey } from "@/lib/onboarding/types";
import { STEP_META, STEP_TOUR_KEY } from "@/lib/onboarding/stepMeta";
import { ALL_TOURS } from "@/lib/tours/registry";
import type { TourConfig } from "@/lib/tours/types";
import { getModuleRoute } from "@/lib/tours/moduleRoute";
import { computeLearningStats } from "@/lib/onboarding/progressStats";

const CTA_LABEL: Record<string, string> = {
  pending: "Comenzar tutorial",
  in_progress: "Continuar tutorial",
  skipped: "Repetir tutorial",
  completed: "Volver a ver tutorial",
};

interface IntroState {
  label: string;
  description: string;
  status: string;
  onConfirm: () => void;
}

/** "Tu progreso en Growth Link" (§29) — combina el checklist inicial (6
 * pasos fijos) con los tours de módulo ya registrados (ALL_TOURS), sin
 * inventar módulos que todavía no tienen tour armado. Reusado en
 * HelpCenterPanel, Perfil y el Sheet que abre DashboardLearningCard.
 *
 * Cada fila es clickeable y reabre el tutorial correspondiente — nunca una
 * segunda implementación de tour, siempre `startTour()` (mismo motor que
 * el resto de la app). "Completado" y "Omitido" no son estados
 * definitivos: repetir un omitido lo pasa a 'in_progress' visible;
 * repetir un completado se queda 'completed' todo el tiempo (es una
 * revisión, no un aprendizaje nuevo). */
export function LearningProgress() {
  const { steps, getLearningStatus, setStepStatus, setLearningStatus, startTour } = useOnboarding();
  const router = useRouter();
  const stats = computeLearningStats(steps, getLearningStatus);
  const [intro, setIntro] = useState<IntroState | null>(null);

  function openStepIntro(step: OnboardingStepKey) {
    const meta = STEP_META[step];
    const status = steps[step];
    setIntro({
      label: meta.label,
      description: meta.description,
      status,
      onConfirm: () => {
        if (status !== "completed") setStepStatus(step, "in_progress");
        router.push(meta.href);
        const tourKey = STEP_TOUR_KEY[step];
        if (tourKey) startTour(tourKey);
        setIntro(null);
      },
    });
  }

  function openTourIntro(tour: TourConfig) {
    const status = getLearningStatus("tour", tour.key);
    setIntro({
      label: tour.title,
      description: tour.steps[0]?.description ?? "Te vamos a mostrar cómo funciona, paso a paso.",
      status,
      onConfirm: () => {
        if (status !== "completed") setLearningStatus("tour", tour.key, "in_progress");
        const route = getModuleRoute(tour.moduleKey);
        if (route) router.push(route);
        startTour(tour.key);
        setIntro(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Tu progreso en Growth Link</span>
          <span className="font-mono text-neutral-500">{stats.pct}%</span>
        </div>
        <ProgressBar value={stats.pct} />
      </div>

      <ul className="flex flex-col gap-0.5">
        {ONBOARDING_STEPS.map((s) => (
          <ProgressRow key={s} label={STEP_META[s].label} status={steps[s]} onClick={() => openStepIntro(s)} />
        ))}
        {ALL_TOURS.map((tour) => (
          <ProgressRow key={tour.key} label={tour.title} status={getLearningStatus("tour", tour.key)} onClick={() => openTourIntro(tour)} />
        ))}
      </ul>

      {intro && (
        <ConfirmDialog
          open
          title={intro.label}
          description={intro.description}
          confirmLabel={CTA_LABEL[intro.status] ?? "Comenzar tutorial"}
          cancelLabel="Cerrar"
          onConfirm={intro.onConfirm}
          onCancel={() => setIntro(null)}
        />
      )}
    </div>
  );
}

function ProgressRow({ label, status, onClick }: { label: string; status: string; onClick: () => void }) {
  const Icon = status === "completed" ? CheckCircle2 : status === "skipped" ? SkipForward : status === "in_progress" ? CircleDot : Circle;
  const cta = CTA_LABEL[status] ?? "Comenzar tutorial";
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
      >
        <Icon
          size={15}
          aria-hidden="true"
          className={cn(
            "shrink-0",
            status === "completed" ? "text-success-strong" : status === "skipped" ? "text-neutral-400" : status === "in_progress" ? "text-accent-500" : "text-neutral-300",
          )}
        />
        <span className={cn("min-w-0 flex-1 truncate", status === "pending" ? "text-neutral-500" : status === "in_progress" ? "font-medium text-accent-700" : "text-foreground")}>
          {label}
          {status === "in_progress" && <span className="ml-1.5 text-xs font-normal text-accent-500">En progreso</span>}
          {status === "skipped" && <span className="ml-1.5 text-xs font-normal text-neutral-400">Omitido</span>}
        </span>
        <span className="shrink-0 text-xs font-medium whitespace-nowrap text-accent-600 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100 group-focus-visible:opacity-100">
          {cta}
        </span>
        <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-neutral-300" />
      </button>
    </li>
  );
}
