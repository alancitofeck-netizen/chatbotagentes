"use client";

import { useState, useTransition } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AutomationListItem } from "@/lib/automations/queries";
import { getAutomationListAction } from "@/lib/automations/actions";
import { AutomationList } from "./AutomationList";
import { CreateAutomationSheet } from "./CreateAutomationSheet";
import { AutomationDetailSheet } from "./AutomationDetailSheet";

/** Moved from the old standalone /automations page into the Perfil >
 * Automatizaciones tab — same components/actions, no logic changes. */
export function AutomationsSection({ initialAutomations }: { initialAutomations: AutomationListItem[] }) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [selected, setSelected] = useState<AutomationListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();

  function refetch() {
    startTransition(async () => {
      setAutomations(await getAutomationListAction());
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-foreground">Automatizaciones</h2>
          <p className="text-sm text-neutral-500">Reglas automáticas por palabra clave para el workspace.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          Nueva automatización
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border-default bg-warning-bg px-4 py-3 text-[13px] text-warning-strong">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Estas reglas se guardan pero todavía <strong>no se ejecutan automáticamente</strong> — el motor de IA
          que las dispararía (Buffer Inteligente + Decision Engine) no está conectado todavía.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
        <AutomationList automations={automations} onSelect={setSelected} onToggled={refetch} />
      </div>

      <AutomationDetailSheet
        key={selected?.id ?? "closed"}
        automation={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          refetch();
          setSelected(null);
        }}
      />
      <CreateAutomationSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />
    </div>
  );
}
