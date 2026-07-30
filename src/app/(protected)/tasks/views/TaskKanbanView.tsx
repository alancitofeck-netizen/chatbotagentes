"use client";

import { useMemo } from "react";
import { KanbanBoard, type KanbanCardBase, type KanbanStage } from "@/components/kanban/KanbanBoard";
import { TaskCard } from "@/components/tasks/TaskCard";
import { toast } from "@/components/toast/toast";
import { moveTask } from "@/lib/tasks/actions";
import type { TaskItem, TaskStatus } from "@/lib/tasks/queries";

interface TaskKanbanCard extends TaskItem, KanbanCardBase {}

/** Task status is a fixed 3-value enum (unlike CRM's configurable pipeline
 * stages), so these columns are hardcoded rather than fetched. */
const STATUS_STAGES: KanbanStage[] = [
  { id: "pending", name: "Pendiente", position: 0 },
  { id: "in_progress", name: "En progreso", position: 1 },
  { id: "completed", name: "Completada", position: 2, isWon: true },
];

/** "Kanban" view — reuses the same generic drag-and-drop primitive already
 * shared between CRM and ATS (src/components/kanban/KanbanBoard.tsx),
 * grouped by `status` instead of a pipeline stage. */
export function TaskKanbanView({
  tasks,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
  onChanged,
}: {
  tasks: TaskItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (task: TaskItem) => void;
  onChanged: () => void;
}) {
  const cardsByStage = useMemo(() => {
    const byStage: Record<string, TaskKanbanCard[]> = { pending: [], in_progress: [], completed: [] };
    for (const t of tasks) {
      const card: TaskKanbanCard = { ...t, pipelineItemId: t.id, stageId: t.status, position: t.position };
      (byStage[t.status] ??= []).push(card);
    }
    for (const key of Object.keys(byStage)) byStage[key].sort((a, b) => a.position - b.position);
    return byStage;
  }, [tasks]);

  function handleMove(taskId: string, stageId: string, position: number) {
    moveTask(taskId, stageId as TaskStatus, position)
      .then(onChanged)
      .catch(() => toast.error("No se pudo mover la tarea. Intenta de nuevo."));
  }

  return (
    <KanbanBoard<TaskKanbanCard>
      stages={STATUS_STAGES}
      initialCardsByStage={cardsByStage}
      renderCard={(card, onOpenDefault) => (
        <TaskCard
          task={card}
          onOpen={() => (selectionMode ? onToggleSelect(card.id) : onOpenDefault())}
          selectionMode={selectionMode}
          selected={selectedIds.has(card.id)}
          onToggleSelect={() => onToggleSelect(card.id)}
        />
      )}
      onOpenCard={(card) => onOpen(card)}
      onMove={handleMove}
      orientation="rows"
      cardWidth="w-[300px]"
    />
  );
}
