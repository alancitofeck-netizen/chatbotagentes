"use client";

import { CheckCircle2, Circle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "./OnboardingContext";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ONBOARDING_STEPS, type OnboardingStepKey } from "@/lib/onboarding/types";
import { ALL_TOURS } from "@/lib/tours/registry";

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
 * HelpCenterPanel y en Perfil. */
export function LearningProgress() {
  const { steps, getLearningStatus } = useOnboarding();

  const onboardingDone = ONBOARDING_STEPS.filter((s) => steps[s] === "completed" || steps[s] === "skipped").length;
  const tourStatuses = ALL_TOURS.map((t) => ({ tour: t, status: getLearningStatus("tour", t.key) }));
  const toursDone = tourStatuses.filter((t) => t.status !== "pending").length;
  const totalItems = ONBOARDING_STEPS.length + ALL_TOURS.length;
  const doneItems = onboardingDone + toursDone;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Tu progreso en Growth Link</span>
          <span className="font-mono text-neutral-500">{pct}%</span>
        </div>
        <ProgressBar value={pct} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {ONBOARDING_STEPS.map((s) => (
          <ProgressRow key={s} label={STEP_LABEL[s]} status={steps[s]} />
        ))}
        {tourStatuses.map(({ tour, status }) => (
          <ProgressRow key={tour.key} label={tour.title} status={status} />
        ))}
      </ul>
    </div>
  );
}

function ProgressRow({ label, status }: { label: string; status: string }) {
  const Icon = status === "completed" ? CheckCircle2 : status === "skipped" ? SkipForward : Circle;
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon
        size={15}
        aria-hidden="true"
        className={cn(status === "completed" ? "text-success-strong" : status === "skipped" ? "text-neutral-400" : "text-neutral-300")}
      />
      <span className={cn(status === "pending" || status === "in_progress" ? "text-neutral-500" : "text-foreground")}>{label}</span>
    </li>
  );
}
