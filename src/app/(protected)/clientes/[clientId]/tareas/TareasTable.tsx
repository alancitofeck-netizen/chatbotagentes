"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, ListTodo, MoreVertical, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import { PRIORITY_META } from "@/components/tasks/priorityMeta";
import { deleteClientTaskAction, getClientTasksAction, updateClientTaskStatusAction } from "@/lib/clients/actions";
import type { ClientTask } from "@/lib/clients/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { estadoCategory, formatDueLabel, getTaskEstadoMeta, type TaskEstadoCategory } from "./taskStatusMeta";
import { CreateTaskSheet } from "./CreateTaskSheet";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

const TONE_CLASS: Record<string, string> = {
  success: "text-success-strong",
  warning: "text-warning-strong",
  error: "text-error-strong",
  neutral: "text-neutral-500",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function TareasTable({
  clientId,
  initialTasks,
  members,
}: {
  clientId: string;
  initialTasks: ClientTask[];
  members: WorkspaceMemberOption[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"all" | TaskEstadoCategory>("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "this_month" | "no_date">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, startTransition] = useTransition();

  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const avatarById = new Map(members.map((m) => [m.memberId, m.avatarUrl]));
  const existingAreas = useMemo(() => [...new Set(tasks.map((t) => t.relatedArea).filter((a): a is string => !!a))], [tasks]);

  const filtered = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.relatedArea ?? "").toLowerCase().includes(q)) return false;
      if (estadoFilter !== "all" && estadoCategory(t) !== estadoFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && t.assignedTo !== assigneeFilter) return false;
      if (dateFilter === "this_month" && !(t.dueAt && new Date(t.dueAt) >= monthStart)) return false;
      if (dateFilter === "no_date" && t.dueAt) return false;
      return true;
    });
  }, [tasks, query, estadoFilter, priorityFilter, assigneeFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function handleToggle(task: ClientTask) {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    const previous = task.status;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus, completedAt: nextStatus === "completed" ? new Date().toISOString() : null } : t)));
    startTransition(async () => {
      try {
        await updateClientTaskStatusAction(task.id, clientId, nextStatus);
      } catch (err) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: previous } : t)));
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la tarea.");
      }
    });
  }

  function handleDelete(task: ClientTask) {
    if (!window.confirm(`¿Eliminar "${task.title}"?`)) return;
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    startTransition(async () => {
      try {
        await deleteClientTaskAction(task.id, clientId);
      } catch (err) {
        setTasks(previous);
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar la tarea.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => resetToFirstPage(setQuery)(e.target.value)}
            placeholder="Buscar tareas…"
            className="w-full rounded-sm border border-border-strong bg-surface-1 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        <select
          value={estadoFilter}
          onChange={(e) => resetToFirstPage(setEstadoFilter)(e.target.value as typeof estadoFilter)}
          className="rounded-sm border border-border-strong bg-surface-1 px-2.5 py-1.5 text-sm outline-none focus:border-accent-500"
        >
          <option value="all">Estado: Todos</option>
          <option value="pending">Pendiente</option>
          <option value="in_progress">En progreso</option>
          <option value="completed">Completada</option>
          <option value="overdue">Vencida</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => resetToFirstPage(setPriorityFilter)(e.target.value)}
          className="rounded-sm border border-border-strong bg-surface-1 px-2.5 py-1.5 text-sm outline-none focus:border-accent-500"
        >
          <option value="all">Prioridad: Todas</option>
          {Object.entries(PRIORITY_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => resetToFirstPage(setAssigneeFilter)(e.target.value)}
          className="rounded-sm border border-border-strong bg-surface-1 px-2.5 py-1.5 text-sm outline-none focus:border-accent-500"
        >
          <option value="all">Responsable: Todos</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => resetToFirstPage(setDateFilter)(e.target.value as typeof dateFilter)}
          className="rounded-sm border border-border-strong bg-surface-1 px-2.5 py-1.5 text-sm outline-none focus:border-accent-500"
        >
          <option value="all">Fecha: Todas</option>
          <option value="this_month">Este mes</option>
          <option value="no_date">Sin fecha</option>
        </select>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          Nueva tarea
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ListTodo} title="Sin tareas" description="No hay tareas que coincidan con estos filtros." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-default text-xs text-neutral-500">
                  <th className="w-8 py-2 pr-2" />
                  <th className="py-2 pr-3 font-medium">Tarea</th>
                  <th className="py-2 pr-3 font-medium">Prioridad</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">Responsable</th>
                  <th className="py-2 pr-3 font-medium">Fecha límite</th>
                  <th className="py-2 pr-3 font-medium">Relacionado con</th>
                  <th className="w-8 py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((task) => {
                  const estado = getTaskEstadoMeta(task);
                  const due = formatDueLabel(task);
                  const priorityMeta = PRIORITY_META[task.priority as keyof typeof PRIORITY_META];
                  return (
                    <tr key={task.id} className="border-b border-border-subtle last:border-0">
                      <td className="py-2 pr-2 align-top">
                        <input type="checkbox" className="mt-1 size-4 rounded-sm border-border-strong" aria-label="Seleccionar tarea" />
                      </td>
                      <td className="py-2 pr-3">
                        <p className={`text-sm font-medium ${task.status === "completed" ? "text-neutral-400 line-through" : "text-foreground"}`}>{task.title}</p>
                        {task.description && <p className="truncate text-xs text-neutral-500">{task.description}</p>}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={priorityMeta?.badgeVariant ?? "neutral"}>{priorityMeta?.label ?? task.priority}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={estado.variant}>{estado.label}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {task.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={nameById.get(task.assignedTo) ?? "?"} src={avatarById.get(task.assignedTo)} size={22} />
                            <span className="text-neutral-500">{nameById.get(task.assignedTo) ?? "—"}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {task.dueAt && <p className="text-neutral-500">{formatDate(task.dueAt)}</p>}
                        <p className={`text-xs ${TONE_CLASS[due.tone]}`}>{due.text}</p>
                      </td>
                      <td className="py-2 pr-3 text-neutral-500">{task.relatedArea ?? "—"}</td>
                      <td className="py-2 pr-2 text-right">
                        <DropdownMenu
                          trigger={<MoreVertical size={16} aria-hidden="true" />}
                          triggerLabel="Acciones"
                          items={[
                            {
                              label: task.status === "completed" ? "Reabrir" : "Marcar completada",
                              icon: task.status === "completed" ? <RotateCcw size={14} aria-hidden="true" /> : <CheckSquare size={14} aria-hidden="true" />,
                              onSelect: () => handleToggle(task),
                            },
                            { label: "Eliminar", icon: <Trash2 size={14} aria-hidden="true" />, destructive: true, onSelect: () => handleDelete(task) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm text-neutral-500">
            <span>
              Mostrando {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} tareas
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex size-7 items-center justify-center rounded-md text-xs ${p === currentPage ? "bg-accent-500 text-[var(--on-accent)]" : "hover:bg-surface-2"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-sm border border-border-strong bg-surface-1 px-2 py-1 text-xs outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    Mostrar {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      <CreateTaskSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        clientId={clientId}
        members={members}
        existingAreas={existingAreas}
        onCreated={async () => setTasks(await getClientTasksAction(clientId))}
      />
    </div>
  );
}
