"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TaskItem } from "@/lib/tasks/queries";
import { completeTask } from "./actions";

function formatDueBadge(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;
  return isMidnight ? "Hoy" : `Hoy ${date.toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" }).toLowerCase()}`;
}

/** Versión liviana (solo tildar) de PendingTasks.tsx — ese componente ya
 * cubre editar/asignar/crear con su propio Sheet; acá el objetivo es "ver
 * de un vistazo qué falta hoy", no duplicar esa gestión completa. */
export function TodayTasksPanel({ tasks }: { tasks: TaskItem[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleToggle(taskId: string) {
    setDone((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    startTransition(async () => {
      await completeTask(taskId);
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Tus pendientes de hoy" action={<Link href="/tasks" className="text-xs font-medium text-accent-600 hover:underline">Ver todas</Link>} />
      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="Sin pendientes para hoy" description="Estás al día." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => {
            const isDone = done.has(t.id);
            const badge = formatDueBadge(t.dueAt);
            return (
              <li key={t.id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => !isDone && handleToggle(t.id)}
                  className="size-4 rounded-sm accent-success-strong"
                  aria-label={`Marcar "${t.title}" como completada`}
                />
                <span className={cn("min-w-0 flex-1 truncate text-sm", isDone ? "text-neutral-400 line-through" : "text-foreground")}>{t.title}</span>
                {badge && !isDone && <span className="shrink-0 rounded-full bg-error-bg px-2 py-0.5 text-[11px] font-medium text-error-strong">{badge}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
