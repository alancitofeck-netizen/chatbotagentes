"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { GROUP_TEMPLATES } from "@/lib/tasks/groups/groupTemplates";
import { createGroupFromTemplate } from "@/lib/tasks/groups/actions";
import { GROUP_COLOR_META } from "./groupColorMeta";

/** "Nueva plantilla" from the "Nuevo" menu — picks from the fixed built-in
 * catalog (src/lib/tasks/groups/groupTemplates.ts) and instantiates a group
 * with its predefined tasks already seeded. */
export function TemplatePickerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (groupId: string) => void }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!selectedKey) return;
    startTransition(async () => {
      try {
        const { id } = await createGroupFromTemplate(selectedKey);
        toast.success("Grupo creado desde la plantilla.");
        onCreated(id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el grupo.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="Nueva plantilla">
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-neutral-500">Elegí una plantilla — se crea el grupo con sus tareas predefinidas.</p>
        <div className="flex flex-col gap-2">
          {GROUP_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelectedKey(t.key)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                selectedKey === t.key ? "border-accent-500 bg-accent-50" : "border-border-default hover:bg-surface-2",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-[17px]", GROUP_COLOR_META[t.color].bg)}>
                {t.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-neutral-500">{t.description}</p>
                <p className="mt-1 text-[11px] text-neutral-400">{t.taskTitles.length} tareas predefinidas: {t.taskTitles.join(", ")}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleCreate} loading={isPending} disabled={!selectedKey}>
            Crear grupo
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
