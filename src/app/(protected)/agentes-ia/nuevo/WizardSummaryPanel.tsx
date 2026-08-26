import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Bot } from "lucide-react";
import { AGENT_TYPE_PRESETS, MODULE_OPTIONS, type WizardState } from "./wizardConfig";
import type { AiToolOption } from "@/lib/ai-agents/queries";

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

/** Puramente derivado del estado del wizard en memoria — sin fetch propio,
 * se re-renderiza solo cuando cambia WizardState. */
export function WizardSummaryPanel({ state, tools }: { state: WizardState; tools: AiToolOption[] }) {
  const moduleLabel = MODULE_OPTIONS.find((m) => m.key === state.moduleKey)?.name ?? state.moduleKey;
  const typePreset = state.moduleKey === "referrals" ? AGENT_TYPE_PRESETS.find((t) => t.key === state.agentType) : null;
  const selectedToolNames = state.toolIds.map((id) => tools.find((t) => t.id === id)?.name).filter((n): n is string => Boolean(n));

  return (
    <Card>
      <CardHeader title="Resumen del agente" />
      <p className="mb-4 text-xs text-neutral-500">Este es un resumen de la información ingresada.</p>

      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <Bot className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-foreground">{state.name || "Nuevo agente"}</p>
          <Badge variant="accent">Nuevo</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SummaryRow label="Tipo" value={typePreset ? `${typePreset.emoji} ${typePreset.name}` : moduleLabel} />
        <SummaryRow label="Objetivo principal" value={state.mainObjective || <span className="text-neutral-400">Sin definir</span>} />
        <SummaryRow
          label="Fuente de contactos"
          value={
            state.moduleKey === "referrals" ? (
              <Badge variant="success">🔒 Referidos CRM (asesoria_referrals)</Badge>
            ) : (
              <Badge variant="neutral">Contactos del CRM</Badge>
            )
          }
        />
        <SummaryRow
          label="Capacidades"
          value={
            selectedToolNames.length === 0 ? (
              <span className="text-neutral-400">Ninguna todavía</span>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {selectedToolNames.map((n) => (
                  <li key={n}>✓ {n}</li>
                ))}
              </ul>
            )
          }
        />
        <SummaryRow label="Seguimientos" value="Manual (crea tareas para el asesor)" />
        <SummaryRow
          label="Adaptación al asesor"
          value={state.moduleKey === "referrals" ? "Análisis disponible después de crear el agente" : "No aplica para CRM"}
        />
      </div>
    </Card>
  );
}
