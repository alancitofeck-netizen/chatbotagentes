"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { ListTodo, Pencil, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { PendingTask } from "@/lib/dashboard/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import { getTaskByIdAction } from "@/lib/tasks/actions";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";
import { completeTask, getPendingTasksAction } from "./actions";

interface MemberOption {
  memberId: string;
  fullName: string;
}

function formatDue(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;
  if (isToday) {
    return isMidnight ? "Hoy" : `Hoy ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
  }
  const dateLabel = date.toLocaleDateString("es", { day: "2-digit", month: "short" });
  return isMidnight ? dateLabel : `${dateLabel} ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
}

export function PendingTasks({
  tasks,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  ownMemberId,
}: {
  tasks: PendingTask[];
  members: MemberOption[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
}) {
  const [taskList, setTaskList] = useState(tasks);
  const [optimisticTasks, removeTask] = useOptimistic(taskList, (state, id: string) => state.filter((t) => t.id !== id));
  const [, startTransition] = useTransition();
  const [sheetState, setSheetState] = useState<{ mode: "create" } | { mode: "edit"; task: TaskItem } | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);

  function handleComplete(id: string) {
    startTransition(async () => {
      removeTask(id);
      await completeTask(id);
    });
  }

  function refetch() {
    startTransition(async () => {
      setTaskList(await getPendingTasksAction());
    });
  }

  async function handleEdit(taskId: string) {
    setEditLoadingId(taskId);
    const task = await getTaskByIdAction(taskId);
    setEditLoadingId(null);
    if (task) setSheetState({ mode: "edit", task });
  }

  return (
    <Card>
      <CardHeader
        title="Tareas pendientes"
        action={
          <Button size="sm" onClick={() => setSheetState({ mode: "create" })}>
            <Plus size={15} aria-hidden="true" />
            Nueva tarea
          </Button>
        }
      />
      {optimisticTasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="Sin tareas pendientes" description="Vas al día." />
      ) : (
        <ul className="flex flex-col gap-1">
          {optimisticTasks.map((task) => {
            const priorityMeta = PRIORITY_META[task.priority as keyof typeof PRIORITY_META];
            const statusMeta = STATUS_META[task.status as keyof typeof STATUS_META];
            const due = formatDue(task.dueAt);
            return (
              <li
                key={task.id}
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-[var(--duration-fast)] hover:bg-surface-2"
              >
                <button
                  type="button"
                  onClick={() => handleComplete(task.id)}
                  aria-label={`Marcar "${task.title}" como completada`}
                  className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong transition-colors hover:border-accent-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{task.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {priorityMeta && (
                      <Badge variant={priorityMeta.badgeVariant} className="px-1.5 py-0 text-[10px]">
                        {priorityMeta.label}
                      </Badge>
                    )}
                    {statusMeta && task.status !== "pending" && (
                      <Badge variant={statusMeta.badgeVariant} className="px-1.5 py-0 text-[10px]">
                        {statusMeta.label}
                      </Badge>
                    )}
                    {due && <span className="text-xs text-neutral-500">{due}</span>}
                    {task.assignedToName && <span className="text-xs text-neutral-400">· {task.assignedToName}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleEdit(task.id)}
                  aria-label={`Editar "${task.title}"`}
                  disabled={editLoadingId === task.id}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 transition-opacity",
                    "hover:bg-surface-3 hover:text-foreground group-hover:opacity-100 disabled:opacity-50",
                  )}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/crm?tab=tasks"
        className="mt-3 block text-center text-[13px] font-medium text-accent-600 hover:underline"
      >
        Ver todas las tareas
      </Link>

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
    </Card>
  );
}
