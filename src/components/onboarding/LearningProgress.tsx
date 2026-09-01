"use client";

import { CheckCircle2, Circle, CircleDot, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "./OnboardingContext";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ONBOARDING_STEPS, type OnboardingStepKey } from "@/lib/onboarding/types";
import { ALL_TOURS } from "@/lib/tours/registry";
import { computeLearningStats } from "@/lib/onboarding/progressStats";

const STEP_LABEL: Record<OnboardingStepKey, string> = {
  profile: "Perfil",
  whatsapp: "WhatsApp",
  manychat: "Instagram / ManyChat",
  calendar: "Calendario",
  crm: "CRM",
  automations: "Automatizaciones",
};

/** "Tu progreso en Growth Link" (§29) — combina el checklist inicial (6
 * pasos fijos) con los tours de módulo ya registrados (ALL_TOURS), sin
 * inventar módulos que todavía no tienen tour armado. Reusado en
 * HelpCenterPanel, Perfil y el Sheet que abre DashboardLearningCard. */
export function LearningProgress() {
  const { steps, getLearningStatus } = useOnboarding();
  const stats = computeLearningStats(steps, getLearningStatus);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Tu progreso en Growth Link</span>
          <span className="font-mono text-neutral-500">{stats.pct}%</span>
        </div>
        <ProgressBar value={stats.pct} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {ONBOARDING_STEPS.map((s) => (
          <ProgressRow key={s} label={STEP_LABEL[s]} status={steps[s]} />
        ))}
        {ALL_TOURS.map((tour) => (
          <ProgressRow key={tour.key} label={tour.title} status={getLearningStatus("tour", tour.key)} />
        ))}
      </ul>
    </div>
  );
}

function ProgressRow({ label, status }: { label: string; status: string }) {
  const Icon = status === "completed" ? CheckCircle2 : status === "skipped" ? SkipForward : status === "in_progress" ? CircleDot : Circle;
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon
        size={15}
        aria-hidden="true"
        className={cn(
          status === "completed" ? "text-success-strong" : status === "skipped" ? "text-neutral-400" : status === "in_progress" ? "text-accent-500" : "text-neutral-300",
        )}
      />
      <span className={cn(status === "pending" ? "text-neutral-500" : status === "in_progress" ? "font-medium text-accent-700" : "text-foreground")}>
        {label}
        {status === "in_progress" && <span className="ml-1.5 text-xs font-normal text-accent-500">En progreso</span>}
        {status === "skipped" && <span className="ml-1.5 text-xs font-normal text-neutral-400">Omitido</span>}
      </span>
    </li>
  );
}
