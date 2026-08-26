import { Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";
import { AGENT_TYPE_PRESETS, MODULE_OPTIONS, type WizardState, type WizardModuleKey, type AgentTypePreset } from "../wizardConfig";

const HOW_IT_WORKS: Record<WizardModuleKey, string[]> = {
  referrals: [
    "Solo trabajará con contactos autorizados provenientes de asesoria_referrals.",
    "Podrá iniciar conversaciones por WhatsApp desde Growth Link.",
    "Mantendrá conversaciones naturales y calificará referidos.",
    "Podrá crear seguimientos y transferir al asesor cuando corresponda.",
  ],
  crm: [
    "Trabajará con los contactos y oportunidades del CRM de este workspace.",
    "Podrá iniciar y responder conversaciones por WhatsApp desde Growth Link.",
    "Podrá calificar contactos y actualizar el CRM.",
    "Podrá transferir al equipo cuando corresponda.",
  ],
};

const FLOW: Record<WizardModuleKey, string[]> = {
  referrals: ["Referido autorizado", "Agente IA", "Conversación calificada", "Reunión agendada"],
  crm: ["Contacto del CRM", "Agente IA", "Conversación calificada", "Oportunidad / reunión"],
};

export function StepIdentity({
  state,
  update,
  workspaceName,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  workspaceName: string;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-4">
        <Card>
          <CardHeader title="Identidad del agente" />
          <p className="mb-4 text-sm text-neutral-500">Definí la identidad básica de tu agente IA.</p>
          <div className="flex flex-col gap-4">
            <Input label="Nombre del agente" value={state.name} onChange={(e) => update({ name: e.target.value })} placeholder="Ej. Agente de Referidos" />
            <div>
              <label className="text-sm font-medium text-foreground">Descripción</label>
              <textarea
                value={state.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={3}
                maxLength={300}
                placeholder="Contacta y gestiona referidos provenientes del CRM…"
                className="mt-1.5 w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{state.description.length} / 300</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">¿Para qué módulo es este agente?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULE_OPTIONS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => update({ moduleKey: m.key, toolIds: [] })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      state.moduleKey === m.key ? "border-accent-500 bg-accent-50" : "border-border-default hover:bg-surface-2",
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-neutral-500">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {state.moduleKey === "referrals" && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">¿Qué querés que haga este agente?</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {AGENT_TYPE_PRESETS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!t.enabled}
                      onClick={() => t.enabled && update({ agentType: t.key as AgentTypePreset })}
                      title={t.enabled ? undefined : "Próximamente"}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        !t.enabled && "cursor-not-allowed opacity-50",
                        t.enabled && state.agentType === t.key ? "border-accent-500 bg-accent-50" : "border-border-default",
                        t.enabled && state.agentType !== t.key && "hover:bg-surface-2",
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">
                        {t.emoji} {t.name}
                      </p>
                      <p className="text-xs text-neutral-500">{t.description}</p>
                      {!t.enabled && <p className="mt-1 text-[11px] font-medium text-neutral-400">Próximamente</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Card className="bg-surface-2">
              <p className="text-sm font-medium text-foreground">Este agente pertenece al workspace</p>
              <p className="text-sm text-foreground">{workspaceName}</p>
              <p className="text-xs text-neutral-500">
                {state.moduleKey === "referrals" ? "Podrá trabajar con los referidos autorizados de este workspace." : "Podrá trabajar con los contactos del CRM de este workspace."}
              </p>
            </Card>
          </div>
        </Card>
      </div>

      <div className="flex w-full flex-col gap-3 lg:max-w-xs">
        <Card>
          <CardHeader title="¿Cómo funcionará este agente?" />
          <ul className="flex flex-col gap-2">
            {HOW_IT_WORKS[state.moduleKey].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success-strong" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            {FLOW[state.moduleKey].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-full bg-surface-3 px-2 py-1 text-foreground">{step}</span>
                {i < arr.length - 1 && <span aria-hidden="true">→</span>}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function stepIdentityIsValid(state: WizardState): boolean {
  return state.name.trim().length > 0;
}
