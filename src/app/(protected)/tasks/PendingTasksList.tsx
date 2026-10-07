"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { completeTask } from "@/lib/tasks/actions";
import type { TaskItem } from "@/lib/tasks/queries";
import type { TaskGroup } from "@/lib/tasks/groups/queries";
import { PRIORITY_META } from "@/components/tasks/priorityMeta";

type DueBucket = "overdue" | "today" | "upcoming" | "none";

const BUCKETS: { key: DueBucket; label: string }[] = [
  { key: "overdue", label: "Vencidas" },
  { key: "today", label: "Hoy" },
  { key: "upcoming", label: "Próximas" },
  { key: "none", label: "Sin fecha" },
];

function bucketOf(task: TaskItem, todayStart: Date, todayEnd: Date): DueBucket {
  if (!task.dueAt) return "none";
  const due = new Date(task.dueAt);
  if (due < todayStart) return "overdue";
  if (due < todayEnd) return "today";
  return "upcoming";
}

function dueLabel(dueAt: string | null, bucket: DueBucket, todayStart: Date) {
  if (!dueAt) return "Sin fecha";
  const due = new Date(dueAt);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - todayStart.getTime()) / 86_400_000);
  if (bucket === "overdue") return `Venció hace ${-diff} ${diff === -1 ? "día" : "días"}`;
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `En ${diff} días`;
}

/** Lista de pendientes agrupada por vencimiento (Vencidas / Hoy / Próximas / Sin fecha) para
 * la pantalla de inicio de Tareas. Mismos datos que el resto del módulo (getTasks); completar
 * usa la misma acción que Agenda y los grupos, con actualización optimista. */
export function PendingTasksList({ tasks: initialTasks, groupsById }: { tasks: TaskItem[]; groupsById: Map<string, TaskGroup> }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [, startTransition] = useTransition();

  const { todayStart, todayEnd } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { todayStart: start, todayEnd: end };
  }, []);

  function handleComplete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      await completeTask(taskId);
    });
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-neutral-500">No tenés tareas pendientes. Buen trabajo.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {BUCKETS.map(({ key, label }) => {
        const items = tasks
          .filter((t) => bucketOf(t, todayStart, todayEnd) === key)
          .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
        if (items.length === 0) return null;
        return (
          <section key={key} aria-label={label}>
            <p className="mx-1 mb-2 mt-3 flex items-center gap-2 text-[13.5px] font-semibold text-neutral-500">
              {label}
              <Badge variant={key === "overdue" ? "error" : "neutral"}>{items.length}</Badge>
            </p>
            <ul className="flex flex-col gap-2">
              {items.map((task) => {
                const group = task.groupId ? groupsById.get(task.groupId) : undefined;
                const high = task.priority === "high" || task.priority === "urgent";
                return (
                  <li key={task.id} className="flex items-start gap-1 rounded-2xl border border-border-default bg-surface-1 p-1.5 pr-3">
                    <button
                      type="button"
                      onClick={() => handleComplete(task.id)}
                      aria-label={`Completar: ${task.title}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full border-2 border-border-strong text-transparent transition-colors hover:border-success-strong hover:text-success-strong">
                        <Check className="size-4" aria-hidden="true" />
                      </span>
                    </button>
                    <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 py-2.5">
                      <p className="text-[15px] font-medium leading-snug text-foreground">{task.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                        {group && <Badge variant="neutral">{group.name}</Badge>}
                        {high && <Badge variant={PRIORITY_META[task.priority].badgeVariant}>{PRIORITY_META[task.priority].label}</Badge>}
                        <span className={cn(key === "overdue" && "font-semibold text-error-strong")} suppressHydrationWarning>
                          {dueLabel(task.dueAt, key, todayStart)}
                        </span>
                        {task.assignedTo && <span>· {task.assignedTo.fullName}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
