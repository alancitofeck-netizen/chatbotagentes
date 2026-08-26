import { Brain } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { ANALYSIS_ASPECT_OPTIONS, type WizardState } from "../wizardConfig";

const PERIODS: { key: WizardState["analysisPeriod"]; label: string }[] = [
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
  { key: "180", label: "180 días" },
  { key: "all", label: "Todo" },
];

/** Solo Referidos — mapea 1:1 a la Fase 9 real (advisorProfile.ts,
 * analyzeAdvisor). Un agente recién creado no tiene conversaciones
 * (MIN_MESSAGES_TO_ANALYZE=20 en ese archivo), así que acá NO se fabrica un
 * preview con valores inventados — se explica la feature real y se aclara
 * cuándo va a estar disponible de verdad. */
export function StepAnalysis({ state, update }: { state: WizardState; update: (patch: Partial<WizardState>) => void }) {
  function toggleAspect(key: string) {
    update({ analysisAspects: state.analysisAspects.includes(key) ? state.analysisAspects.filter((a) => a !== key) : [...state.analysisAspects, key] });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Adaptar el agente al estilo de tus asesores" />
        <p className="mb-4 text-sm text-neutral-500">
          El agente puede analizar conversaciones históricas para comprender cómo trabajan tus asesores y adaptar su comunicación y
          proceso comercial.
        </p>

        <p className="mb-2 text-sm font-medium text-foreground">¿Qué querés que analice?</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ANALYSIS_ASPECT_OPTIONS.map((a) => {
            const active = state.analysisAspects.includes(a.key);
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => toggleAspect(a.key)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  active ? "border-accent-500 bg-accent-50 text-foreground" : "border-border-default text-neutral-600 hover:bg-surface-2",
                )}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        <p className="mb-2 mt-4 text-sm font-medium text-foreground">Período a analizar</p>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => update({ analysisPeriod: p.key })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                state.analysisPeriod === p.key ? "border-accent-500 bg-accent-500 text-white" : "border-border-default text-neutral-600 hover:bg-surface-2",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-lg border border-dashed border-border-strong p-4">
          <Brain className="mt-0.5 size-5 shrink-0 text-neutral-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Perfil del asesor — todavía no disponible</p>
            <p className="text-sm text-neutral-500">
              Este agente todavía no existe, así que no hay conversaciones reales para analizar. Una vez creado y con actividad real,
              vas a poder generar este análisis de verdad desde la pestaña &quot;Perfil del asesor&quot; del agente.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
