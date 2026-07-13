"use client";

import { useMemo, useState, useTransition } from "react";
import { ListTodo, Pencil, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import { completeTask, getTasksAction } from "@/lib/tasks/actions";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const dateLabel = date.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
  return hasTime ? `${dateLabel} ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}` : dateLabel;
}

export function TasksSection({
  initialTasks,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  ownMemberId,
}: {
  initialTasks: TaskItem[];
  members: WorkspaceMemberOption[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sheetState, setSheetState] = useState<{ mode: "create" } | { mode: "edit"; task: TaskItem } | null>(null);
  const [, startTransition] = useTransition();

  function refetch() {
    startTransition(async () => {
      setTasks(await getTasksAction());
    });
  }

  function handleComplete(id: string) {
    startTransition(async () => {
      await completeTask(id);
      refetch();
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assignedTo?.memberId !== assigneeFilter) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, assigneeFilter, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-foreground">Tareas</h2>
        <Button size="sm" onClick={() => setSheetState({ mode: "create" })}>
          <Plus size={15} aria-hidden="true" />
          Nueva tarea
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-[38px] text-neutral-400" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Buscar</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título…"
                className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </div>
          </div>
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} containerClassName="w-40">
            <option value="">Todas</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
          <Select label="Prioridad" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} containerClassName="w-40">
            <option value="">Todas</option>
            {Object.entries(PRIORITY_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
          <Select label="Asignado" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} containerClassName="w-48">
            <option value="">Todos</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={ListTodo} title="Sin tareas" description="No hay resultados para estos filtros." />
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {filtered.map((task) => {
              const priorityMeta = PRIORITY_META[task.priority];
              const statusMeta = STATUS_META[task.status];
              return (
                <li key={task.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    disabled={task.status === "completed"}
                    onClick={() => handleComplete(task.id)}
                    aria-label={`Marcar "${task.title}" como completada`}
                    className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong transition-colors hover:border-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {task.status === "completed" && <span className="size-2 rounded-[2px] bg-accent-500" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={task.status === "completed" ? "truncate text-sm text-neutral-400 line-through" : "truncate text-sm text-foreground"}>
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={priorityMeta.badgeVariant}>{priorityMeta.label}</Badge>
                      <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                      <span className="text-xs text-neutral-500">{formatDate(task.dueAt)}</span>
                      {task.assignedTo && <span className="text-xs text-neutral-400">· {task.assignedTo.fullName}</span>}
                      {task.relatedLabel && <span className="text-xs text-neutral-400">· {task.relatedLabel}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheetState({ mode: "edit", task })}
                    aria-label={`Editar "${task.title}"`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {sheetState && (
        <TaskFormSheet
          current={sheetState.mode === "edit" ? sheetState.task : null}
          members={members}
          contactOptions={contactOptions}
          conversationOptions={conversationOptions}
          canAssignOthers={canAssignOthers}
          ownMemberId={ownMemberId}
          onClose={() => setSheetState(null)}
          onSaved={() => {
            setSheetState(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
