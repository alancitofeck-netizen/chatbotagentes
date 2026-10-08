"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { FilterChips } from "@/components/ui/FilterChips";
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

type TaskFilter = "pending" | "mine" | "team" | "high" | "completed";

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "mine", label: "Mías" },
  { value: "team", label: "Del equipo" },
  { value: "high", label: "Alta prioridad" },
  { value: "completed", label: "Completadas" },
];

const EMPTY: Record<TaskFilter, string> = {
  pending: "No tenés tareas pendientes. Buen trabajo.",
  mine: "No tenés tareas pendientes a tu nombre.",
  team: "Tu equipo no tiene tareas pendientes.",
  high: "No hay tareas pendientes de alta prioridad.",
  completed: "Todavía no hay tareas completadas.",
};

const isHigh = (t: TaskItem) => t.priority === "high" || t.priority === "urgent";

/** "Mías" = asignadas a mí, o sin asignar y creadas por mí. El resto es "Del equipo". */
function isMine(t: TaskItem, ownMemberId: string | null) {
  if (!ownMemberId) return false;
  return t.assignedTo ? t.assignedTo.memberId === ownMemberId : t.createdByMemberId === ownMemberId;
}

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

/** Lista de tareas del inicio de Tareas, con chips de filtro (Pendientes / Mías / Del equipo /
 * Alta prioridad / Completadas). Las pendientes se agrupan por vencimiento (Vencidas / Hoy /
 * Próximas / Sin fecha). Mismos datos que el resto del módulo (getTasks); completar usa la misma
 * acción que Agenda y los grupos, con actualización optimista. */
export function PendingTasksList({
  tasks: initialTasks,
  groupsById,
  ownMemberId,
}: {
  tasks: TaskItem[];
  groupsById: Map<string, TaskGroup>;
  ownMemberId: string | null;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<TaskFilter>("pending");
  const [, startTransition] = useTransition();

  const { todayStart, todayEnd } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { todayStart: start, todayEnd: end };
  }, []);

  function handleComplete(taskId: string) {
    const completedAt = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed", completedAt } : t)));
    startTransition(async () => {
      await completeTask(taskId);
    });
  }

  const pending = tasks.filter((t) => t.status !== "completed");
  const shown =
    filter === "completed"
      ? tasks.filter((t) => t.status === "completed").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      : filter === "mine"
        ? pending.filter((t) => isMine(t, ownMemberId))
        : filter === "team"
          ? pending.filter((t) => !isMine(t, ownMemberId))
          : filter === "high"
            ? pending.filter(isHigh)
            : pending;

  return (
    <div className="flex flex-col gap-1">
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      {shown.length === 0 && <p className="mx-1 mt-3 text-sm text-neutral-500">{EMPTY[filter]}</p>}
      {filter === "completed" && shown.length > 0 && (
        <section aria-label="Completadas">
          <p className="mx-1 mb-2 mt-3 flex items-center gap-2 text-[13.5px] font-semibold text-neutral-500">
            Completadas
            <Badge variant="success">{shown.length}</Badge>
          </p>
          <ul className="flex flex-col gap-2">
            {shown.map((task) => (
              <li key={task.id} className="flex items-center gap-1 rounded-2xl border border-border-default bg-surface-1 p-1.5 pr-3">
                <span className="flex size-11 shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="flex size-7 items-center justify-center rounded-full bg-success-strong text-white">
                    <Check className="size-4" />
                  </span>
                </span>
                <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 py-2.5">
                  <p className="text-[15px] font-medium leading-snug text-neutral-500 line-through">{task.title}</p>
                  {task.assignedTo && <p className="mt-1 text-xs text-neutral-500">{task.assignedTo.fullName}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {filter !== "completed" && BUCKETS.map(({ key, label }) => {
        const items = shown
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
                const high = isHigh(task);
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
