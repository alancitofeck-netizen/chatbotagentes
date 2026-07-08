"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export interface KanbanStage {
  id: string;
  name: string;
  position: number;
  isWon?: boolean;
  isLost?: boolean;
}

export interface KanbanCardBase {
  pipelineItemId: string;
  stageId: string;
  position: number;
}

function Column<T extends KanbanCardBase>({
  stageId,
  name,
  cards,
  isWon,
  isLost,
  renderCard,
  onOpenCard,
  footer,
}: {
  stageId: string;
  name: string;
  cards: T[];
  isWon?: boolean;
  isLost?: boolean;
  renderCard: (card: T, onOpen: () => void) => ReactNode;
  onOpenCard: (card: T) => void;
  footer?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });

  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${isWon ? "bg-success" : isLost ? "bg-error" : "bg-accent-500"}`}
          />
          <span className="text-[13px] font-medium text-foreground">{name}</span>
          <span className="text-xs text-neutral-400">{cards.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-2 transition-colors ${
          isOver ? "bg-accent-50" : "bg-surface-2"
        }`}
      >
        <SortableContext items={cards.map((c) => c.pipelineItemId)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <div key={card.pipelineItemId}>{renderCard(card, () => onOpenCard(card))}</div>
          ))}
        </SortableContext>
      </div>
      {footer}
    </div>
  );
}

/** Generic drag-and-drop Kanban board — extracted from the CRM board so ATS
 * (and any future pipeline-backed module) can reuse the same @dnd-kit
 * orchestration instead of duplicating it (07-ats.md: "el tablero kanban de
 * la UI del ATS es el mismo componente que el tablero del CRM"). Callers own
 * card rendering (and each card's own useSortable wiring) via `renderCard`,
 * and own error handling for `onMove` (fire-and-forget; catch + toast there). */
export function KanbanBoard<T extends KanbanCardBase>({
  stages,
  initialCardsByStage,
  renderCard,
  onOpenCard,
  onMove,
  columnFooter,
}: {
  stages: KanbanStage[];
  initialCardsByStage: Record<string, T[]>;
  renderCard: (card: T, onOpen: () => void) => ReactNode;
  onOpenCard: (card: T) => void;
  onMove: (pipelineItemId: string, stageId: string, position: number) => void;
  columnFooter?: (cards: T[]) => ReactNode;
}) {
  const [columns, setColumns] = useState(initialCardsByStage);
  const [activeCard, setActiveCard] = useState<T | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cardsById = useMemo(() => {
    const map = new Map<string, T>();
    for (const stageCards of Object.values(columns)) {
      for (const c of stageCards) map.set(c.pipelineItemId, c);
    }
    return map;
  }, [columns]);

  function findStageOf(pipelineItemId: string) {
    return Object.entries(columns).find(([, cards]) => cards.some((c) => c.pipelineItemId === pipelineItemId))?.[0];
  }

  function handleDragStart(event: DragStartEvent) {
    const card = cardsById.get(event.active.id as string);
    setActiveCard(card ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeStage = findStageOf(active.id as string);
    const overStage = stages.some((s) => s.id === over.id)
      ? (over.id as string)
      : findStageOf(over.id as string);

    if (!activeStage || !overStage || activeStage === overStage) return;

    setColumns((prev) => {
      const activeCards = [...prev[activeStage]];
      const cardIndex = activeCards.findIndex((c) => c.pipelineItemId === active.id);
      if (cardIndex === -1) return prev;
      const [moved] = activeCards.splice(cardIndex, 1);
      const overCards = [...(prev[overStage] ?? [])];
      overCards.push({ ...moved, stageId: overStage });
      return { ...prev, [activeStage]: activeCards, [overStage]: overCards };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const stageId = findStageOf(active.id as string);
    if (!stageId) return;

    const stageCards = columns[stageId] ?? [];
    const oldIndex = stageCards.findIndex((c) => c.pipelineItemId === active.id);
    const overIndex = stageCards.findIndex((c) => c.pipelineItemId === over.id);
    const newIndex = overIndex === -1 ? stageCards.length - 1 : overIndex;

    if (oldIndex !== newIndex && oldIndex !== -1) {
      const reordered = [...stageCards];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      setColumns((prev) => ({ ...prev, [stageId]: reordered }));
    }

    onMove(active.id as string, stageId, newIndex);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stageId={stage.id}
            name={stage.name}
            cards={columns[stage.id] ?? []}
            isWon={stage.isWon}
            isLost={stage.isLost}
            renderCard={renderCard}
            onOpenCard={onOpenCard}
            footer={columnFooter?.(columns[stage.id] ?? [])}
          />
        ))}
      </div>
      <DragOverlay>{activeCard && renderCard(activeCard, () => {})}</DragOverlay>
    </DndContext>
  );
}
