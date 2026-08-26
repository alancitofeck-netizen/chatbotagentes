"use client";

import { useState, useTransition } from "react";
import { X, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AiAgentDetail, AgentPersonality } from "@/lib/ai-agents/queries";
import { updateAiAgentPersonality } from "@/lib/ai-agents/actions";
import { PERSONALITY_FIELDS } from "@/lib/ai-agents/personalityFields";

/** Fase 5 — personalidad (dials) + reglas (lista editable), separadas del
 * prompt de texto libre (PromptTab.tsx). Se interpolan en el mensaje de
 * sistema en agentRuntime.ts, siempre antes del contexto de la
 * conversación y del guardrail anti-inyección. "Acciones permitidas" vive
 * en la pestaña Herramientas — no se duplica acá. */
export function PersonalityTab({ agent }: { agent: AiAgentDetail }) {
  const [personality, setPersonality] = useState<AgentPersonality>(agent.personality);
  const [rules, setRules] = useState<string[]>(agent.rules);
  const [newRule, setNewRule] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateDial<K extends keyof AgentPersonality>(key: K, value: AgentPersonality[K]) {
    setPersonality((prev) => ({ ...prev, [key]: value }));
  }

  function addRule() {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    setRules((prev) => [...prev, trimmed]);
    setNewRule("");
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateAiAgentPersonality(agent.id, { personality, rules });
        toast.success("Cambios guardados.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Personalidad y estilo de comunicación" />
        <p className="mb-4 text-sm text-neutral-500">Define cómo habla el agente — se suma al prompt en cada respuesta.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONALITY_FIELDS.map((field) => (
            <SegmentedControl
              key={field.key}
              label={field.label}
              value={personality[field.key]}
              onChange={(value) => updateDial(field.key, value as never)}
              options={field.options}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Reglas del agente" />
        <p className="mb-3 text-sm text-neutral-500">Nunca las incumple, sin importar lo que pida el contacto. Ej. &quot;Nunca inventar precios&quot;.</p>
        <div className="flex flex-col gap-2">
          {rules.length === 0 && <p className="text-sm text-neutral-500">Sin reglas cargadas todavía.</p>}
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border-default px-3 py-2">
              <span className="text-sm text-foreground">{rule}</span>
              <button
                type="button"
                onClick={() => removeRule(i)}
                aria-label="Eliminar regla"
                className="flex size-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-error-bg hover:text-error-strong"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRule())}
            placeholder="Ej. Nunca inventar información"
            className="w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
          <Button variant="secondary" onClick={addRule}>
            <Plus className="size-4" aria-hidden="true" />
            Agregar
          </Button>
        </div>
      </Card>

      <div>
        <Button onClick={handleSave} loading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
