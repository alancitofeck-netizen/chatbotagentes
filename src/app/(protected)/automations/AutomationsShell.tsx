"use client";

import { useState, useTransition } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AutomationListItem } from "@/lib/automations/queries";
import { getAutomationListAction } from "@/lib/automations/actions";
import { AutomationList } from "./AutomationList";
import { CreateAutomationSheet } from "./CreateAutomationSheet";
import { AutomationDetailSheet } from "./AutomationDetailSheet";

export function AutomationsShell({ initialAutomations }: { initialAutomations: AutomationListItem[] }) {
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border-default px-6 py-4">
        <h1 className="text-[17px] font-semibold text-foreground">Automatizaciones</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          Nueva automatización
        </Button>
      </div>

      <div className="flex items-start gap-2 border-b border-border-default bg-warning-bg px-6 py-3 text-[13px] text-warning-strong">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Estas reglas se guardan pero todavía <strong>no se ejecutan automáticamente</strong> — el motor de IA
          que las dispararía (Buffer Inteligente + Decision Engine) no está conectado todavía.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AutomationList
          automations={automations}
          onSelect={setSelected}
          onToggled={refetch}
        />
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
