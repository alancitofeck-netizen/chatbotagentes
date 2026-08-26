"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { toast } from "@/components/toast/toast";
import { PERSONALITY_FIELDS } from "@/lib/ai-agents/personalityFields";
import { improvePromptDraftAction } from "@/lib/ai-agents/actions";
import type { WizardState } from "../wizardConfig";

/** El prompt inicial se siembra en AgentWizardShell.goNext() (al entrar a
 * este paso por primera vez), no acá vía efecto — evita el anti-patrón de
 * "setState síncrono dentro de un effect" y mantiene la única fuente del
 * estado en el shell. */
export function StepBrain({ state, update }: { state: WizardState; update: (patch: Partial<WizardState>) => void }) {
  const [proposal, setProposal] = useState<string | null>(null);
  const [isImproving, startImprove] = useTransition();

  function handleImprove() {
    startImprove(async () => {
      try {
        const { improvedPrompt } = await improvePromptDraftAction({
          currentPrompt: state.systemPrompt,
          agentName: state.name,
          description: state.description,
          moduleKey: state.moduleKey,
          objectives: state.objectives,
          mainObjective: state.mainObjective,
        });
        setProposal(improvedPrompt);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo mejorar el prompt.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Configurá el cerebro del agente"
          action={
            <Button size="sm" variant="secondary" onClick={handleImprove} loading={isImproving}>
              <Sparkles className="size-3.5" aria-hidden="true" />
              Mejorar con IA
            </Button>
          }
        />
        <p className="mb-2 text-sm text-neutral-500">Prompt principal — las instrucciones que definen cómo se comporta el agente.</p>
        <textarea
          value={state.systemPrompt}
          onChange={(e) => update({ systemPrompt: e.target.value, promptTouched: true })}
          rows={12}
          className="w-full rounded-sm border border-border-strong bg-surface-1 p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />

        {proposal && (
          <div className="mt-3 rounded-lg border border-accent-500/30 bg-accent-50 p-3">
            <p className="mb-2 text-xs font-medium text-accent-700">Propuesta de la IA — no se aplicó todavía</p>
            <p className="whitespace-pre-wrap rounded-md bg-surface-1 p-2 text-[13px] text-foreground">{proposal}</p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  update({ systemPrompt: proposal, promptTouched: true });
                  setProposal(null);
                }}
              >
                <Check className="size-3.5" aria-hidden="true" />
                Usar este prompt
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setProposal(null)}>
                <X className="size-3.5" aria-hidden="true" />
                Descartar
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Personalidad" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONALITY_FIELDS.map((field) => (
            <SegmentedControl
              key={field.key}
              label={field.label}
              value={state.personality[field.key]}
              onChange={(value) => update({ personality: { ...state.personality, [field.key]: value as never } })}
              options={field.options}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
