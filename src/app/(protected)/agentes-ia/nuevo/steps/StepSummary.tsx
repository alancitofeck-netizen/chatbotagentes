import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AGENT_TYPE_PRESETS, MODULE_OPTIONS, SYSTEM_RULES, type WizardState } from "../wizardConfig";
import type { AiToolOption } from "@/lib/ai-agents/queries";

export function StepSummary({ state, tools }: { state: WizardState; tools: AiToolOption[] }) {
  const moduleLabel = MODULE_OPTIONS.find((m) => m.key === state.moduleKey)?.name ?? state.moduleKey;
  const typePreset = state.moduleKey === "referrals" ? AGENT_TYPE_PRESETS.find((t) => t.key === state.agentType) : null;
  const selectedTools = state.toolIds.map((id) => tools.find((t) => t.id === id)?.name).filter((n): n is string => Boolean(n));
  const allRules = [...SYSTEM_RULES[state.moduleKey], ...state.customRules];

  return (
    <Card>
      <CardHeader title="Revisá tu agente" />
      <div className="mb-4 flex items-center gap-3">
        <span className="text-2xl">{typePreset?.emoji ?? "🤖"}</span>
        <div>
          <p className="text-[15px] font-semibold text-foreground">{state.name || "Sin nombre"}</p>
          <p className="text-sm text-neutral-500">{state.description || "Sin descripción"}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Tipo</dt>
          <dd className="text-sm text-foreground">{typePreset ? typePreset.name : moduleLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Objetivo</dt>
          <dd className="text-sm text-foreground">{state.mainObjective || "Sin definir"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Fuente</dt>
          <dd className="text-sm text-foreground">{state.moduleKey === "referrals" ? "🔒 Referidos CRM" : "Contactos del CRM"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Seguimientos</dt>
          <dd className="text-sm text-foreground">Manual</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-xs text-neutral-500">Acciones</p>
        {selectedTools.length === 0 ? (
          <p className="text-sm text-neutral-400">Ninguna seleccionada</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {selectedTools.map((n) => (
              <Badge key={n} variant="accent">
                ✓ {n}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs text-neutral-500">Reglas ({allRules.length})</p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {allRules.map((r) => (
            <li key={r} className="text-sm text-foreground">
              ✓ {r}
            </li>
          ))}
        </ul>
      </div>

      {state.moduleKey === "referrals" && (
        <div className="mt-4">
          <p className="text-xs text-neutral-500">Adaptación</p>
          <p className="text-sm text-foreground">Análisis del asesor pendiente — disponible después de crear el agente</p>
        </div>
      )}
    </Card>
  );
}
