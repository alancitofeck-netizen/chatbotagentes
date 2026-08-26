import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { OBJECTIVE_OPTIONS, type WizardState } from "../wizardConfig";

export function StepObjective({ state, update }: { state: WizardState; update: (patch: Partial<WizardState>) => void }) {
  function toggle(key: string) {
    update({ objectives: state.objectives.includes(key) ? state.objectives.filter((o) => o !== key) : [...state.objectives, key] });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="¿Qué debe conseguir este agente?" />
        <p className="mb-3 text-sm text-neutral-500">Elegí uno o más objetivos — le dan forma al prompt inicial del agente.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OBJECTIVE_OPTIONS.map((o) => {
            const active = state.objectives.includes(o.key);
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => toggle(o.key)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  active ? "border-accent-500 bg-accent-50 text-foreground" : "border-border-default text-neutral-600 hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-accent-500 bg-accent-500" : "border-border-strong",
                  )}
                >
                  {active && <span className="size-1.5 rounded-full bg-white" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Objetivo principal" />
        <textarea
          value={state.mainObjective}
          onChange={(e) => update({ mainObjective: e.target.value })}
          rows={2}
          placeholder="Ej. Conseguir reuniones calificadas para los asesores."
          className="w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </Card>
    </div>
  );
}
