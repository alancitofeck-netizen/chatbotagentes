import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { STEP_LABELS, type WizardStep } from "./wizardConfig";

export function WizardStepIndicator({ steps, currentIndex }: { steps: readonly WizardStep[]; currentIndex: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <div key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCurrent && "bg-accent-500 text-white",
                  isDone && "bg-accent-100 text-accent-700",
                  !isCurrent && !isDone && "bg-surface-3 text-neutral-500",
                )}
              >
                {isDone ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-sm font-medium", isCurrent ? "text-foreground" : "text-neutral-500")}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 shrink-0 bg-border-default" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
