"use client";

import { CheckSquare, MessageSquare, Paperclip, Table as TableIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/utils/format";
import type { TaskItem } from "@/lib/tasks/queries";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";

function formatDueDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

/** "Tabla" view — same wide sortable-columns pattern as CRM's
 * OpportunityTable.tsx, same filtered `tasks` array as every other view. */
export function TaskTableView({
  tasks,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
}: {
  tasks: TaskItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (task: TaskItem) => void;
}) {
  if (tasks.length === 0) {
    return <EmptyState icon={TableIcon} title="Sin resultados" description="Ningún registro coincide con los filtros aplicados." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs text-neutral-500">
            {selectionMode && <th className="w-10 px-3 py-2.5" />}
            <th className="px-3 py-2.5 font-medium">Título</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 font-medium">Prioridad</th>
            <th className="px-3 py-2.5 font-medium">Vencimiento</th>
            <th className="px-3 py-2.5 font-medium">Responsable</th>
            <th className="px-3 py-2.5 font-medium">Relación</th>
            <th className="px-3 py-2.5 font-medium">Subtareas</th>
            <th className="px-3 py-2.5 font-medium">Comentarios</th>
            <th className="px-3 py-2.5 font-medium">Archivos</th>
            <th className="px-3 py-2.5 font-medium">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
              {selectionMode && (
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => onToggleSelect(task.id)}
                    className="size-4 rounded border-border-strong accent-[var(--color-accent-500)]"
                  />
                </td>
              )}
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className={`text-left font-medium hover:text-accent-700 ${task.status === "completed" ? "text-neutral-400 line-through" : "text-foreground"}`}
                >
                  {task.title}
                </button>
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={STATUS_META[task.status].badgeVariant}>{STATUS_META[task.status].label}</Badge>
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={PRIORITY_META[task.priority].badgeVariant}>{PRIORITY_META[task.priority].label}</Badge>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-neutral-600">{formatDueDate(task.dueAt)}</td>
              <td className="px-3 py-2.5 text-neutral-600">
                {task.assignedTo ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar name={task.assignedTo.fullName} src={task.assignedTo.avatarUrl} size={20} />
                    {task.assignedTo.fullName}
                  </span>
                ) : (
                  "Sin asignar"
                )}
              </td>
              <td className="px-3 py-2.5 text-neutral-600">{task.relatedLabel ?? "—"}</td>
              <td className="px-3 py-2.5 text-neutral-600">
                {task.checklistTotal > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckSquare className="size-3.5" aria-hidden="true" />
                    {task.checklistDone}/{task.checklistTotal}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2.5 text-neutral-600">
                {task.commentCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3.5" aria-hidden="true" />
                    {task.commentCount}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2.5 text-neutral-600">
                {task.attachmentCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {task.attachmentCount}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-neutral-500" suppressHydrationWarning>
                {formatRelativeTime(task.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
