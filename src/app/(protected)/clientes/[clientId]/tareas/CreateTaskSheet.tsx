"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createClientTaskAction, type CreateClientTaskInput } from "@/lib/clients/actions";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";

/** Sheet de creación — mismo patrón "drawer premium" que EditClientSheet.tsx
 * (rediseño reciente del módulo). "Relacionado con" es texto libre
 * (tasks.related_area, 0128, carga manual) con sugerencias de las áreas ya
 * usadas en este cliente, no un catálogo fijo inventado. */
export function CreateTaskSheet({
  open,
  onClose,
  clientId,
  members,
  existingAreas,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  members: WorkspaceMemberOption[];
  existingAreas: string[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CreateClientTaskInput["priority"]>("medium");
  const [ownerSide, setOwnerSide] = useState<CreateClientTaskInput["ownerSide"]>("growth_link");
  const [assignedTo, setAssignedTo] = useState(members[0]?.memberId ?? "");
  const [dueAt, setDueAt] = useState("");
  const [relatedArea, setRelatedArea] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setOwnerSide("growth_link");
    setAssignedTo(members[0]?.memberId ?? "");
    setDueAt("");
    setRelatedArea("");
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("El título es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      await createClientTaskAction(clientId, {
        title,
        description: description.trim() || undefined,
        priority,
        ownerSide,
        assignedTo,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        relatedArea: relatedArea.trim() || null,
      });
      toast.success("Tarea creada.");
      reset();
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nueva tarea">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} uiSize="lg" />
        <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} uiSize="lg" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </Select>
          <Select label="Responsable" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Lado" value={ownerSide} onChange={(e) => setOwnerSide(e.target.value as typeof ownerSide)}>
            <option value="growth_link">Growth Link</option>
            <option value="client">Cliente</option>
          </Select>
          <Input label="Fecha límite" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} uiSize="lg" />
        </div>
        <div>
          <Input
            label="Relacionado con"
            value={relatedArea}
            onChange={(e) => setRelatedArea(e.target.value)}
            uiSize="lg"
            placeholder="LinkedIn, Agenda, Meta Ads…"
            list="related-area-suggestions"
          />
          <datalist id="related-area-suggestions">
            {existingAreas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div className="mt-2 flex gap-2">
          <Button onClick={handleSubmit} loading={saving} fullWidth>
            Crear tarea
          </Button>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
