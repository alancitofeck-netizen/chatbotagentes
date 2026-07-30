"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarCheck } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/format";
import { completeTask } from "@/lib/tasks/actions";
import type { TaskItem } from "@/lib/tasks/queries";
import type { TaskGroup } from "@/lib/tasks/groups/queries";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";
import { GROUP_COLOR_META } from "@/components/tasks/groupColorMeta";

/** Cross-group Agenda (Hoy/Esta semana) — a simple list, not the full 4-view
 * board (that's a per-group concept). Each row shows which group the task
 * belongs to, since this is the one place tasks from different groups
 * appear side by side. */
export function AgendaList({ tasks: initialTasks, groupsById }: { tasks: TaskItem[]; groupsById: Map<string, TaskGroup> }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [, startTransition] = useTransition();

  /** Optimistic, not `router.refresh()` — same reasoning as
   * GroupDetailShell's handleToggleComplete: completeTask's
   * revalidatePath("/tasks") can supersede a same-route refresh triggered
   * right after it, leaving this list stuck until a manual reload. */
  function handleComplete(taskId: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed" as const, completedAt: new Date().toISOString() } : t)));
    startTransition(async () => {
      await completeTask(taskId);
    });
  }

  if (tasks.length === 0) {
    return <EmptyState icon={CalendarCheck} title="Nada por acá" description="No hay tareas en este rango." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => {
        const group = task.groupId ? groupsById.get(task.groupId) : undefined;
        return (
          <li key={task.id} className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 p-3">
            <input
              type="checkbox"
              checked={task.status === "completed"}
              disabled={task.status === "completed"}
              onChange={() => handleComplete(task.id)}
              className="size-4 shrink-0 rounded border-border-strong accent-[var(--color-accent-500)]"
              aria-label="Marcar como completada"
            />
            <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
              <p className={task.status === "completed" ? "truncate text-sm text-neutral-400 line-through" : "truncate text-sm font-medium text-foreground"}>
                {task.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={STATUS_META[task.status].badgeVariant}>{STATUS_META[task.status].label}</Badge>
                <Badge variant={PRIORITY_META[task.priority].badgeVariant}>{PRIORITY_META[task.priority].label}</Badge>
                {task.dueAt && (
                  <span className="text-xs text-neutral-500" suppressHydrationWarning>
                    {formatRelativeTime(task.dueAt)}
                  </span>
                )}
              </div>
            </Link>
            {group && (
              <Link
                href={`/tasks/groups/${group.id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${GROUP_COLOR_META[group.color].bg} ${GROUP_COLOR_META[group.color].text}`}
              >
                <span>{group.icon}</span>
                {group.name}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
