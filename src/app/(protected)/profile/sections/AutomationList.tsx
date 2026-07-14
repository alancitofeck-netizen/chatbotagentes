"use client";

import { useTransition } from "react";
import { Trash2, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { AutomationListItem } from "@/lib/automations/queries";
import { deleteAutomation, toggleAutomationEnabled } from "@/lib/automations/actions";

export function AutomationList({
  automations,
  onSelect,
  onToggled,
}: {
  automations: AutomationListItem[];
  onSelect: (automation: AutomationListItem) => void;
  onToggled: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(e: React.MouseEvent, automation: AutomationListItem) {
    e.stopPropagation();
    startTransition(async () => {
      await toggleAutomationEnabled(automation.id, !automation.enabled);
      onToggled();
    });
  }

  function handleDelete(e: React.MouseEvent, automation: AutomationListItem) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la automatización "${automation.name}"?`)) return;
    startTransition(async () => {
      await deleteAutomation(automation.id);
      toast.success("Automatización eliminada.");
      onToggled();
    });
  }

  if (automations.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Workflow}
          title="Sin automatizaciones"
          description="Creá una regla de palabra clave para empezar."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {automations.map((a) => (
        <li key={a.id} className="flex items-center gap-3 border-b border-border-default px-4 py-3 last:border-b-0 hover:bg-surface-2">
          <button
            type="button"
            onClick={() => onSelect(a)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="truncate text-[13px] text-neutral-500">
              {a.triggerKeyword ? `Palabra clave: "${a.triggerKeyword}"` : "Sin trigger"}
            </p>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={(e) => handleToggle(e, a)}
            className="disabled:opacity-50"
          >
            <Badge variant={a.enabled ? "success" : "neutral"}>{a.enabled ? "Activa" : "Inactiva"}</Badge>
          </button>
          <button
            type="button"
            aria-label="Eliminar automatización"
            disabled={isPending}
            onClick={(e) => handleDelete(e, a)}
            className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong disabled:opacity-50"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
