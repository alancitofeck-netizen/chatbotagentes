"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { Zap } from "lucide-react";
import { COLLECTION_STATUSES, COLLECTION_BUCKET_LABEL } from "@/lib/collections/constants";
import { getCollectionAutomationRulesAction, updateCollectionAutomationRuleAction } from "@/lib/collections/actions";
import type { CollectionAutomationRule, CollectionAutomationRulePatch } from "@/lib/collections/automationRules";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-accent-600" />
      {label}
    </label>
  );
}

/** Configuración de las reglas del motor de recordatorios de cobro
 * (collection_automation_rules, 0100) — corre por hora vía pg_cron/pg_net
 * (0101) + /api/cron/collection-automations. Mismo criterio que Pólizas: no
 * hay envío automático de WhatsApp al cliente, se genera una tarea con el
 * link ya armado para que el asesor lo mande con un clic. */
export function CollectionAutomationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rules, setRules] = useState<CollectionAutomationRule[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    getCollectionAutomationRulesAction().then(setRules);
  }, [open]);

  function patchRule(ruleId: string, patch: CollectionAutomationRulePatch) {
    setRules((prev) => (prev ? prev.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)) : prev));
    startTransition(async () => {
      try {
        await updateCollectionAutomationRuleAction(ruleId, patch);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la regla.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Automatizaciones de cobro">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-2 rounded-md bg-accent-50 p-3 text-xs text-accent-700">
          <Zap className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Cada regla corre una vez por hora sobre los cobros pendientes/en seguimiento. Se dispara una sola vez por cobro y fecha de vencimiento — si lo reprogramás, vuelve a poder avisar para la nueva fecha.
        </div>

        {!rules ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-1 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{rule.name}</p>
                  <label className="flex items-center gap-2 text-xs text-neutral-500">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => patchRule(rule.id, { enabled: e.target.checked })}
                      className="size-4 rounded accent-accent-600"
                      disabled={isPending}
                    />
                    Activa
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Toggle checked={rule.createTask} onChange={(v) => patchRule(rule.id, { createTask: v })} label="Crear tarea" />
                  <Toggle checked={rule.notifyOwner} onChange={(v) => patchRule(rule.id, { notifyOwner: v })} label="Notificar al asesor" />
                  <Toggle checked={rule.suggestWhatsapp} onChange={(v) => patchRule(rule.id, { suggestWhatsapp: v })} label="Sugerir WhatsApp" />
                  <Toggle checked={rule.sendEmail} onChange={(v) => patchRule(rule.id, { sendEmail: v })} label="Enviar email al cliente" />
                </div>

                <Select
                  label="Mover a estado"
                  value={rule.moveToStatus ?? ""}
                  onChange={(e) => patchRule(rule.id, { moveToStatus: e.target.value || null })}
                >
                  <option value="">No mover de estado</option>
                  {COLLECTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {COLLECTION_BUCKET_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
