import { Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { TOOL_GROUPS, type WizardState } from "../wizardConfig";
import type { AiToolOption } from "@/lib/ai-agents/queries";

export function StepActions({ state, update, tools }: { state: WizardState; update: (patch: Partial<WizardState>) => void; tools: AiToolOption[] }) {
  const toolByKey = new Map(tools.map((t) => [t.key, t]));
  const groups = TOOL_GROUPS[state.moduleKey];

  function toggle(toolId: string) {
    update({ toolIds: state.toolIds.includes(toolId) ? state.toolIds.filter((id) => id !== toolId) : [...state.toolIds, toolId] });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="WhatsApp" />
        <p className="text-sm text-neutral-500">
          Capacidad base de cualquier agente activo con canal WhatsApp — no se activa por separado.
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {["Iniciar conversaciones", "Responder mensajes", "Mantener conversaciones", "Generar mensajes personalizados"].map((l) => (
            <li key={l} className="flex items-center gap-2 text-sm text-foreground">
              <Check className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
      </Card>

      {groups.map((group) => (
        <Card key={group.key}>
          <CardHeader title={group.name} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.toolKeys.map((key) => {
              const tool = toolByKey.get(key);
              if (!tool) return null;
              const active = state.toolIds.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => toggle(tool.id)}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                    active ? "border-accent-500 bg-accent-50" : "border-border-default hover:bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                      active ? "border-accent-500 bg-accent-500" : "border-border-strong",
                    )}
                  >
                    {active && <Check className="size-3 text-white" aria-hidden="true" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tool.name}</p>
                    {tool.description && <p className="text-xs text-neutral-500">{tool.description}</p>}
                  </div>
                </button>
              );
            })}
          </div>
          {group.key === "asesor" && (
            <p className="mt-2 text-xs text-neutral-500">Al transferir la conversación, el asesor asignado recibe una notificación automática.</p>
          )}
        </Card>
      ))}

      {state.moduleKey === "referrals" && (
        <Card className="bg-surface-2">
          <p className="text-sm text-foreground">Seguimientos y tareas</p>
          <p className="text-xs text-neutral-500">
            Este agente puede programar seguimientos (máx. 3 intentos por referido) — cada seguimiento vencido sin respuesta se convierte
            automáticamente en una tarea asignada al asesor. No hay envío de mensajes automático fuera de una conversación real.
          </p>
        </Card>
      )}
    </div>
  );
}
