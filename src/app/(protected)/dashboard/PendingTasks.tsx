"use client";

import { useOptimistic, useTransition } from "react";
import { ListTodo } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PendingTask } from "@/lib/dashboard/queries";
import { completeTask } from "./actions";

function formatDue(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? `Hoy ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

export function PendingTasks({ tasks }: { tasks: PendingTask[] }) {
  const [optimisticTasks, removeTask] = useOptimistic(tasks, (state, id: string) =>
    state.filter((t) => t.id !== id),
  );
  const [, startTransition] = useTransition();

  function handleComplete(id: string) {
    startTransition(async () => {
      removeTask(id);
      await completeTask(id);
    });
  }

  return (
    <Card>
      <CardHeader title="Tareas pendientes" />
      {optimisticTasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="Sin tareas pendientes" description="Vas al día." />
      ) : (
        <ul className="flex flex-col gap-1">
          {optimisticTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2">
              <button
                type="button"
                onClick={() => handleComplete(task.id)}
                aria-label={`Marcar "${task.title}" como completada`}
                className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong hover:border-accent-500"
              />
              <span className="flex-1 truncate text-sm text-foreground">{task.title}</span>
              {task.dueAt && <span className="shrink-0 text-xs text-neutral-500">{formatDue(task.dueAt)}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
