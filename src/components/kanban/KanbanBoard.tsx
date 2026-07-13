"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

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
  valueLabel,
  renderCard,
  onOpenCard,
  footer,
  width,
}: {
  stageId: string;
  name: string;
  cards: T[];
  isWon?: boolean;
  isLost?: boolean;
  valueLabel?: string;
  renderCard: (card: T, onOpen: () => void) => ReactNode;
  onOpenCard: (card: T) => void;
  footer?: ReactNode;
  width?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`flex ${width ?? "w-[280px]"} min-h-0 shrink-0 flex-col gap-3`}>
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`size-1.5 shrink-0 rounded-full ${isWon ? "bg-success" : isLost ? "bg-error" : "bg-accent-500"}`}
          />
          <span className="truncate text-[13px] font-medium text-foreground">{name}</span>
          <span className="shrink-0 text-xs text-neutral-400">{cards.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 text-neutral-400 hover:text-foreground"
          title={collapsed ? "Expandir" : "Contraer"}
        >
          {collapsed ? <ChevronRight className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
        </button>
      </div>
      {valueLabel && !collapsed && <p className="shrink-0 px-1 -mt-2 font-mono text-xs text-neutral-500">{valueLabel}</p>}
      <div
        ref={setNodeRef}
        className={
          collapsed
            ? "rounded-lg bg-surface-2 p-2"
            : `min-h-0 flex-1 overflow-y-auto rounded-lg p-2 transition-colors ${isOver ? "bg-accent-50" : "bg-surface-2"}`
        }
      >
        {!collapsed && (
          <SortableContext items={cards.map((c) => c.pipelineItemId)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {cards.map((card) => (
                <div key={card.pipelineItemId}>{renderCard(card, () => onOpenCard(card))}</div>
              ))}
            </div>
          </SortableContext>
        )}
      </div>
      {!collapsed && footer}
    </div>
  );
}

/** Same stage semantics as Column, laid out as a full-width horizontal band
 * instead of a vertical strip — each stage stacks on top of the next (page
 * scrolls down to see more stages) and its own cards scroll horizontally.
 * Used by the CRM board (`orientation="rows"`) so the whole board reads
 * top-to-bottom like the rest of the app instead of being confined to a
 * cramped horizontally-scrolling strip. ATS keeps the original Column layout. */
function Row<T extends KanbanCardBase>({
  stageId,
  name,
  cards,
  isWon,
  isLost,
  valueLabel,
  renderCard,
  onOpenCard,
  footer,
  cardWidth,
}: {
  stageId: string;
  name: string;
  cards: T[];
  isWon?: boolean;
  isLost?: boolean;
  valueLabel?: string;
  renderCard: (card: T, onOpen: () => void) => ReactNode;
  onOpenCard: (card: T) => void;
  footer?: ReactNode;
  cardWidth?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-3">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`size-1.5 shrink-0 rounded-full ${isWon ? "bg-success" : isLost ? "bg-error" : "bg-accent-500"}`}
          />
          <span className="truncate text-[13px] font-medium text-foreground">{name}</span>
          <span className="shrink-0 text-xs text-neutral-400">{cards.length}</span>
          {valueLabel && <span className="shrink-0 font-mono text-xs text-neutral-500">· {valueLabel}</span>}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 text-neutral-400 hover:text-foreground"
          title={collapsed ? "Expandir" : "Contraer"}
        >
          {collapsed ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronUp className="size-3.5" aria-hidden="true" />}
        </button>
      </div>
      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`flex min-h-[76px] items-center gap-3 overflow-x-auto rounded-lg p-2 transition-colors ${isOver ? "bg-accent-50" : "bg-surface-2"}`}
        >
          <SortableContext items={cards.map((c) => c.pipelineItemId)} strategy={horizontalListSortingStrategy}>
            {cards.length === 0 ? (
              <p className="p-3 text-xs text-neutral-400">Sin tarjetas en esta etapa.</p>
            ) : (
              cards.map((card) => (
                <div key={card.pipelineItemId} className={`shrink-0 ${cardWidth ?? "w-[280px]"}`}>
                  {renderCard(card, () => onOpenCard(card))}
                </div>
              ))
            )}
          </SortableContext>
        </div>
      )}
      {!collapsed && footer}
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
  columnValueLabel,
  columnWidth,
  orientation = "columns",
  cardWidth,
}: {
  stages: KanbanStage[];
  initialCardsByStage: Record<string, T[]>;
  renderCard: (card: T, onOpen: () => void) => ReactNode;
  onOpenCard: (card: T) => void;
  onMove: (pipelineItemId: string, stageId: string, position: number) => void;
  columnFooter?: (cards: T[]) => ReactNode;
  columnValueLabel?: (cards: T[]) => string | undefined;
  columnWidth?: string;
  /** "columns" (default, used by ATS): stages side-by-side, board itself scrolls horizontally.
   * "rows" (used by the CRM board): stages stacked top-to-bottom, each stage's own cards
   * scroll horizontally — avoids confining the whole board to a small horizontally-scrolling
   * strip; the page scrolls down naturally to reveal more stages instead. */
  orientation?: "columns" | "rows";
  cardWidth?: string;
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
      // closestCorners compares the dragged card's corners against every droppable's
      // corners — great for "columns" mode (each column is a tall, similarly-sized
      // box), but unreliable in "rows" mode: an empty stage's row is a short strip
      // next to much taller stacks, so its corners are rarely "closest" even when the
      // pointer is directly over it. pointerWithin (literal pointer-in-rect) fixes that.
      collisionDetection={orientation === "rows" ? pointerWithin : closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {orientation === "rows" ? (
        <div className="flex flex-col gap-3 px-4 pb-4 sm:px-6 lg:px-8">
          {stages.map((stage) => (
            <Row
              key={stage.id}
              stageId={stage.id}
              name={stage.name}
              cards={columns[stage.id] ?? []}
              isWon={stage.isWon}
              isLost={stage.isLost}
              renderCard={renderCard}
              onOpenCard={onOpenCard}
              footer={columnFooter?.(columns[stage.id] ?? [])}
              valueLabel={columnValueLabel?.(columns[stage.id] ?? [])}
              cardWidth={cardWidth}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-1 gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8">
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
              valueLabel={columnValueLabel?.(columns[stage.id] ?? [])}
              width={columnWidth}
            />
          ))}
        </div>
      )}
      <DragOverlay>{activeCard && renderCard(activeCard, () => {})}</DragOverlay>
    </DndContext>
  );
}
