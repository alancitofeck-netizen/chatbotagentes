"use client";

import { ListTodo } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard } from "@/components/tasks/TaskCard";
import { SwipeableTaskCard } from "@/components/tasks/SwipeableTaskCard";
import { useIsMobile } from "@/lib/utils/useMediaQuery";
import type { TaskItem } from "@/lib/tasks/queries";

/** "Lista" view — evolution of CRM's old TasksSection.tsx flat `<ul>`, now
 * rendering the rich TaskCard (Sección 1) and supporting multi-select. All 4
 * views (Lista/Tabla/Kanban/Calendario) read this same already-filtered
 * `tasks` array — TasksModuleShell owns the one filter/search pass.
 * Below `md` (and outside multi-select, which already has its own bulk
 * delete/complete affordances) each card swipes to complete/delete instead
 * of plain TaskCard — see optimización mobile Fase 2. */
export function TaskListView({
  tasks,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
  onToggleComplete,
  onDelete,
}: {
  tasks: TaskItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (task: TaskItem) => void;
  onToggleComplete: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
}) {
  const isMobile = useIsMobile();

  if (tasks.length === 0) {
    return <EmptyState icon={ListTodo} title="Sin tareas" description="No hay resultados para estos filtros." />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {tasks.map((task) =>
        isMobile && !selectionMode ? (
          <SwipeableTaskCard
            key={task.id}
            task={task}
            onOpen={() => onOpen(task)}
            onToggleComplete={task.status === "completed" ? undefined : () => onToggleComplete(task)}
            onDelete={() => onDelete(task)}
          />
        ) : (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={() => onOpen(task)}
            onToggleComplete={task.status === "completed" ? undefined : () => onToggleComplete(task)}
            selectionMode={selectionMode}
            selected={selectedIds.has(task.id)}
            onToggleSelect={() => onToggleSelect(task.id)}
          />
        ),
      )}
    </div>
  );
}
