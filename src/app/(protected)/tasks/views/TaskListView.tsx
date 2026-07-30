"use client";

import { ListTodo } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard } from "@/components/tasks/TaskCard";
import type { TaskItem } from "@/lib/tasks/queries";

/** "Lista" view — evolution of CRM's old TasksSection.tsx flat `<ul>`, now
 * rendering the rich TaskCard (Sección 1) and supporting multi-select. All 4
 * views (Lista/Tabla/Kanban/Calendario) read this same already-filtered
 * `tasks` array — TasksModuleShell owns the one filter/search pass. */
export function TaskListView({
  tasks,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
  onToggleComplete,
}: {
  tasks: TaskItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (task: TaskItem) => void;
  onToggleComplete: (task: TaskItem) => void;
}) {
  if (tasks.length === 0) {
    return <EmptyState icon={ListTodo} title="Sin tareas" description="No hay resultados para estos filtros." />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onOpen={() => onOpen(task)}
          onToggleComplete={task.status === "completed" ? undefined : () => onToggleComplete(task)}
          selectionMode={selectionMode}
          selected={selectedIds.has(task.id)}
          onToggleSelect={() => onToggleSelect(task.id)}
        />
      ))}
    </div>
  );
}
