"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SYSTEM_RULES, type WizardState } from "../wizardConfig";

export function StepRules({ state, update }: { state: WizardState; update: (patch: Partial<WizardState>) => void }) {
  const [newRule, setNewRule] = useState("");
  const systemRules = SYSTEM_RULES[state.moduleKey];

  function addRule() {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    update({ customRules: [...state.customRules, trimmed] });
    setNewRule("");
  }

  function removeRule(index: number) {
    update({ customRules: state.customRules.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Reglas del sistema" />
        <p className="mb-3 text-sm text-neutral-500">Reglas críticas que este agente siempre respeta — no se pueden quitar.</p>
        <div className="flex flex-col gap-2">
          {systemRules.map((rule) => (
            <div key={rule} className="flex items-center gap-2 rounded-md border border-border-default bg-surface-2 px-3 py-2">
              <Check className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
              <span className="text-sm text-foreground">{rule}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Reglas personalizadas" />
        <p className="mb-3 text-sm text-neutral-500">Sumá reglas propias de tu negocio — se agregan a las del sistema.</p>
        <div className="flex flex-col gap-2">
          {state.customRules.length === 0 && <p className="text-sm text-neutral-500">Sin reglas personalizadas todavía.</p>}
          {state.customRules.map((rule, i) => (
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
            placeholder="Ej. Nunca ofrecer descuentos"
            className="w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
          <Button variant="secondary" onClick={addRule}>
            <Plus className="size-4" aria-hidden="true" />
            Agregar regla
          </Button>
        </div>
      </Card>
    </div>
  );
}
