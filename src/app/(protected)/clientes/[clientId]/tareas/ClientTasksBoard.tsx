"use client";

import { useState } from "react";
import { Plus, CheckCircle2, Circle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";
import { createClientTaskAction, updateClientTaskStatusAction, getClientTasksAction } from "@/lib/clients/actions";
import type { ClientTask } from "@/lib/clients/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function NewTaskForm({
  members,
  onCreate,
  onCancel,
}: {
  members: WorkspaceMemberOption[];
  onCreate: (input: { title: string; priority: "low" | "medium" | "high" | "urgent"; assignedTo: string; dueAt: string | null }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [assignedTo, setAssignedTo] = useState(members[0]?.memberId ?? "");
  const [dueAt, setDueAt] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong p-3">
      <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          {Object.entries(PRIORITY_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select label="Responsable" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>
      </div>
      <Input label="Fecha límite" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      <div className="flex gap-2">
        <Button
          onClick={() => {
            if (!title.trim()) {
              toast.error("El título es obligatorio.");
              return;
            }
            onCreate({ title, priority, assignedTo, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
          }}
        >
          Crear
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function TaskColumn({
  title,
  hint,
  tasks,
  members,
  nameById,
  onToggle,
  onCreate,
}: {
  title: string;
  hint: string;
  tasks: ClientTask[];
  members: WorkspaceMemberOption[];
  nameById: Map<string, string>;
  onToggle: (task: ClientTask) => void;
  onCreate: (input: { title: string; priority: "low" | "medium" | "high" | "urgent"; assignedTo: string; dueAt: string | null }) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <Card className="flex-1">
      <CardHeader
        title={title}
        action={
          <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} aria-hidden="true" />
            Nueva
          </Button>
        }
      />
      <p className="mb-3 text-xs text-neutral-500">{hint}</p>

      {showForm && (
        <div className="mb-3">
          <NewTaskForm
            members={members}
            onCancel={() => setShowForm(false)}
            onCreate={(input) => {
              onCreate(input);
              setShowForm(false);
            }}
          />
        </div>
      )}

      {tasks.length === 0 && !showForm ? (
        <EmptyState icon={Circle} title="Sin tareas" />
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface-1 p-3">
              <button type="button" onClick={() => onToggle(task)} aria-label="Marcar completada">
                {task.status === "completed" ? (
                  <CheckCircle2 className="size-5 text-success-strong" aria-hidden="true" />
                ) : (
                  <Circle className="size-5 text-neutral-300" aria-hidden="true" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${task.status === "completed" ? "text-neutral-400 line-through" : "text-foreground"}`}>{task.title}</p>
                <p className="text-xs text-neutral-500">
                  {task.assignedTo ? (nameById.get(task.assignedTo) ?? "—") : "Sin asignar"}
                  {task.dueAt ? ` · ${formatDate(task.dueAt)}` : ""}
                </p>
              </div>
              <Badge variant={PRIORITY_META[task.priority as keyof typeof PRIORITY_META]?.badgeVariant ?? "neutral"}>
                {PRIORITY_META[task.priority as keyof typeof PRIORITY_META]?.label ?? task.priority}
              </Badge>
              <Badge variant={STATUS_META[task.status as keyof typeof STATUS_META]?.badgeVariant ?? "neutral"}>
                {STATUS_META[task.status as keyof typeof STATUS_META]?.label ?? task.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Split visual explícitamente pedido: "qué nos falta a nosotros vs qué
 * esperamos del cliente" — tasks.owner_side (0125) es la única fuente,
 * tasks.status sigue siendo pending/in_progress/completed sin tocar. */
export function ClientTasksBoard({ clientId, initialTasks, members }: { clientId: string; initialTasks: ClientTask[]; members: WorkspaceMemberOption[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));

  async function refetch() {
    setTasks(await getClientTasksAction(clientId));
  }

  async function handleToggle(task: ClientTask) {
    try {
      await updateClientTaskStatusAction(task.id, clientId, task.status === "completed" ? "pending" : "completed");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la tarea.");
    }
  }

  async function handleCreate(ownerSide: "client" | "growth_link", input: { title: string; priority: "low" | "medium" | "high" | "urgent"; assignedTo: string; dueAt: string | null }) {
    try {
      await createClientTaskAction(clientId, { ...input, ownerSide });
      toast.success("Tarea creada.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea.");
    }
  }

  const clientTasks = tasks.filter((t) => t.ownerSide === "client");
  const growthLinkTasks = tasks.filter((t) => t.ownerSide === "growth_link");

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <TaskColumn
        title="Esperando del cliente"
        hint="Acciones que necesitamos que el cliente complete."
        tasks={clientTasks}
        members={members}
        nameById={nameById}
        onToggle={handleToggle}
        onCreate={(input) => handleCreate("client", input)}
      />
      <TaskColumn
        title="Acción requerida por Growth Link"
        hint="Lo que nosotros le debemos a este cliente."
        tasks={growthLinkTasks}
        members={members}
        nameById={nameById}
        onToggle={handleToggle}
        onCreate={(input) => handleCreate("growth_link", input)}
      />
    </div>
  );
}
