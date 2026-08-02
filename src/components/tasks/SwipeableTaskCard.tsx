"use client";

import { CheckCircle2, Trash2 } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { useSwipeAction } from "@/lib/utils/useSwipeAction";
import type { TaskItem } from "@/lib/tasks/queries";

/** Mobile-only swipe wrapper around TaskCard (optimización mobile Fase 2) —
 * TaskCard itself is untouched and still used as-is everywhere else
 * (Kanban, etc.), this only adds the gesture layer where TaskListView opts
 * into it. Swipe right reveals green/"Completar", swipe left reveals
 * red/"Eliminar" — no confirm() dialog, a full swipe past the threshold IS
 * the confirmation (same posture as Gmail/Todoist mobile), see
 * useSwipeAction's COMMIT_THRESHOLD_PX. */
export function SwipeableTaskCard({
  task,
  onOpen,
  onToggleComplete,
  onDelete,
}: {
  task: TaskItem;
  onOpen: () => void;
  onToggleComplete?: () => void;
  onDelete: () => void;
}) {
  const { deltaX, handlers } = useSwipeAction(
    () => onToggleComplete?.(),
    () => onDelete(),
  );

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ touchAction: "pan-y" }}>
      <div
        className={`absolute inset-0 flex items-center px-5 transition-opacity ${deltaX !== 0 ? "opacity-100" : "opacity-0"} ${
          deltaX > 0 ? "justify-start bg-success-bg" : "justify-end bg-error-bg"
        }`}
      >
        {deltaX > 0 ? (
          <span className="flex items-center gap-2 font-medium text-success-strong">
            <CheckCircle2 size={20} aria-hidden="true" />
            Completar
          </span>
        ) : (
          <span className="flex items-center gap-2 font-medium text-error-strong">
            Eliminar
            <Trash2 size={20} aria-hidden="true" />
          </span>
        )}
      </div>
      <div
        className={deltaX === 0 ? "transition-transform duration-200 ease-[var(--ease-out)]" : ""}
        style={{ transform: `translateX(${deltaX}px)` }}
        {...handlers}
      >
        <TaskCard task={task} onOpen={onOpen} onToggleComplete={onToggleComplete} />
      </div>
    </div>
  );
}
