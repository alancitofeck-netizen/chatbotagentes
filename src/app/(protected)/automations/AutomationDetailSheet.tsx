"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AutomationListItem } from "@/lib/automations/queries";
import { deleteAutomation, updateAutomation } from "@/lib/automations/actions";

/** `automation` comes already loaded from the list (no async detail fetch),
 * so — same as BookingDetailSheet — there's no loading→loaded race to guard
 * against with a remount key beyond the id itself (handled by the parent). */
export function AutomationDetailSheet({
  automation,
  onClose,
  onChanged,
}: {
  automation: AutomationListItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!automation) return null;
  return <AutomationDetailContent automation={automation} onClose={onClose} onChanged={onChanged} />;
}

function AutomationDetailContent({
  automation,
  onClose,
  onChanged,
}: {
  automation: AutomationListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(automation.name);
  const [keyword, setKeyword] = useState(automation.triggerKeyword ?? "");
  const [responseBody, setResponseBody] = useState(automation.actionBody ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (!keyword.trim()) {
      toast.error("La palabra clave es obligatoria.");
      return;
    }
    startTransition(async () => {
      try {
        await updateAutomation(automation.id, { name, keyword, responseBody });
        toast.success("Automatización actualizada.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la automatización.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar la automatización "${automation.name}"?`)) return;
    startTransition(async () => {
      await deleteAutomation(automation.id);
      toast.success("Automatización eliminada.");
      onChanged();
    });
  }

  return (
    <Sheet open onClose={onClose} title={automation.name}>
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Palabra clave (trigger)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <Input label="Respuesta (acción)" value={responseBody} onChange={(e) => setResponseBody(e.target.value)} />
        <Button onClick={handleSave} loading={isPending}>
          Guardar cambios
        </Button>
        <Button variant="destructive" onClick={handleDelete} loading={isPending}>
          Eliminar
        </Button>
      </div>
    </Sheet>
  );
}
