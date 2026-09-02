"use client";

import { KanbanBoard as GenericKanbanBoard } from "@/components/kanban/KanbanBoard";
import type { OpportunityCard, PipelineStage } from "@/lib/crm/queries";
import { moveOpportunityCard } from "@/lib/crm/actions";
import { toast } from "@/components/toast/toast";
import { formatCurrency } from "@/lib/utils/format";
import { OpportunityCardView } from "./OpportunityCardView";

export function KanbanBoard({
  stages,
  cardsByStage,
  avgOpenValue,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
  onEdit,
  onNote,
  onTask,
  onChanged,
}: {
  stages: PipelineStage[];
  cardsByStage: Record<string, OpportunityCard[]>;
  avgOpenValue: number;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (card: OpportunityCard) => void;
  onEdit: (card: OpportunityCard) => void;
  onNote: (card: OpportunityCard) => void;
  onTask: (card: OpportunityCard) => void;
  onChanged: () => void;
}) {
  function handleMove(pipelineItemId: string, stageId: string, position: number) {
    moveOpportunityCard(pipelineItemId, stageId, position)
      .then(onChanged)
      .catch(() => {
        toast.error("No se pudo mover la tarjeta. Intenta de nuevo.");
      });
  }

  // Columnas lado a lado (mismo modo "columns" que ya usa ATS) — fiel a la
  // referencia visual del rediseño, en desktop y en mobile por igual (antes
  // el desktop usaba "rows"/etapas apiladas; se unifica a columnas, decisión
  // confirmada explícitamente). El drag táctil real (TouchSensor) que ya
  // traía este modo sigue funcionando igual en mobile.
  return (
    <GenericKanbanBoard<OpportunityCard>
      stages={stages}
      initialCardsByStage={cardsByStage}
      renderCard={(card, onOpenDefault) => (
        <OpportunityCardView
          card={card}
          stages={stages}
          avgOpenValue={avgOpenValue}
          selectionMode={selectionMode}
          selected={selectedIds.has(card.id)}
          onToggleSelect={() => onToggleSelect(card.id)}
          onOpen={() => (selectionMode ? onToggleSelect(card.id) : onOpenDefault())}
          onEdit={() => onEdit(card)}
          onNote={() => onNote(card)}
          onTask={() => onTask(card)}
        />
      )}
      onOpenCard={(card) => onOpen(card)}
      onMove={handleMove}
      columnValueLabel={(cards) => {
        const total = cards.reduce((sum, c) => sum + c.value, 0);
        return total > 0 ? formatCurrency(total) : undefined;
      }}
      orientation="columns"
      cardWidth="w-[min(85vw,272px)] sm:w-[272px]"
      columnWidth="w-[min(85vw,272px)] sm:w-[272px]"
    />
  );
}
