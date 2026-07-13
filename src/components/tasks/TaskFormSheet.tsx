"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createTask, updateTask, type TaskInput } from "@/lib/tasks/actions";
import type { TaskItem, TaskOption, TaskRelatedType, TaskStatus } from "@/lib/tasks/queries";
import { PRIORITY_META, STATUS_META } from "./priorityMeta";

interface MemberOption {
  memberId: string;
  fullName: string;
}

function splitDueAt(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = d.getHours() === 0 && d.getMinutes() === 0 ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

function combineDueAt(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = (time || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

/** Single form for both create and edit — same convention as
 * WhatsAppIntegrationSheet/EditProfileSheet (conditionally mounted by the
 * parent, state seeded directly from `current`, no resync effect). Estado
 * only renders in edit mode — creation always starts "pending", matching
 * the field list the user actually asked for in each mode. */
export function TaskFormSheet({
  current,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  ownMemberId,
  onClose,
  onSaved,
}: {
  current: TaskItem | null;
  members: MemberOption[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(current);
  const { date: initialDate, time: initialTime } = splitDueAt(current?.dueAt ?? null);

  const [title, setTitle] = useState(current?.title ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [priority, setPriority] = useState(current?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(current?.status ?? "pending");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [assignedTo, setAssignedTo] = useState(current?.assignedTo?.memberId ?? ownMemberId ?? "");
  const [relatedType, setRelatedType] = useState<TaskRelatedType | "">(current?.relatedType ?? "");
  const [relatedId, setRelatedId] = useState(current?.relatedId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: TaskInput = {
      title,
      description,
      priority,
      dueAt: combineDueAt(date, time),
      assignedTo,
      relatedType: relatedType || null,
      relatedId: relatedType ? relatedId || null : null,
    };

    startTransition(async () => {
      try {
        if (isEdit && current) {
          await updateTask(current.id, { ...input, status });
        } else {
          await createTask(input);
        }
        toast.success(isEdit ? "Tarea actualizada." : "Tarea creada.");
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la tarea.");
      }
    });
  }

  const relatedOptions = relatedType === "contact" ? contactOptions : relatedType === "conversation" ? conversationOptions : [];

  return (
    <Sheet open onClose={onClose} title={isEdit ? "Editar tarea" : "Nueva tarea"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="task-description">
            Descripción
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          {Object.entries(PRIORITY_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>

        {isEdit && (
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        )}

        <div className="flex gap-3">
          <Input
            label="Fecha límite"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            containerClassName="flex-1"
          />
          <Input
            label="Hora (opcional)"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!date}
            containerClassName="w-32"
          />
        </div>

        {canAssignOthers ? (
          <Select label="Asignar a" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.memberId === ownMemberId ? `${m.fullName} (vos)` : m.fullName}
              </option>
            ))}
          </Select>
        ) : (
          <Input label="Asignar a" value="Vos" disabled hint="Tu rol solo permite asignarte tareas a vos mismo." />
        )}

        <div className="flex gap-3">
          <Select
            label="Relacionar con"
            value={relatedType}
            onChange={(e) => {
              setRelatedType(e.target.value as TaskRelatedType | "");
              setRelatedId("");
            }}
            containerClassName="flex-1"
          >
            <option value="">Sin relación</option>
            <option value="contact">Contacto</option>
            <option value="conversation">Conversación de WhatsApp</option>
          </Select>
          {relatedType && (
            <Select
              label={relatedType === "contact" ? "Contacto" : "Conversación"}
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              containerClassName="flex-1"
            >
              <option value="">Elegir…</option>
              {relatedOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? "Guardar cambios" : "Crear tarea"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
