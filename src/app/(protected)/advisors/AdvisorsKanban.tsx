"use client";

import { KanbanBoard as GenericKanbanBoard } from "@/components/kanban/KanbanBoard";
import type { AdvisorStage, DealCard } from "@/lib/advisors/queries";
import { moveDeal } from "@/lib/advisors/actions";
import { toast } from "@/components/toast/toast";
import { formatCurrency } from "@/lib/utils/format";
import { DealCardView } from "./DealCardView";

export function AdvisorsKanban({
  stages,
  cardsByStage,
  onOpen,
  onEdit,
  onNote,
  onChanged,
}: {
  stages: AdvisorStage[];
  cardsByStage: Record<string, DealCard[]>;
  onOpen: (card: DealCard) => void;
  onEdit: (card: DealCard) => void;
  onNote: (card: DealCard) => void;
  onChanged: () => void;
}) {
  function handleMove(pipelineItemId: string, stageId: string, position: number) {
    moveDeal(pipelineItemId, stageId, position)
      .then(onChanged)
      .catch(() => toast.error("No se pudo mover la póliza. Intenta de nuevo."));
  }

  return (
    <GenericKanbanBoard<DealCard>
      stages={stages}
      initialCardsByStage={cardsByStage}
      renderCard={(card, onOpenDefault) => (
        <DealCardView card={card} onOpen={onOpenDefault} onEdit={() => onEdit(card)} onNote={() => onNote(card)} />
      )}
      onOpenCard={(card) => onOpen(card)}
      onMove={handleMove}
      columnValueLabel={(cards) => {
        const total = cards.reduce((sum, c) => sum + c.value, 0);
        return total > 0 ? formatCurrency(total) : undefined;
      }}
      orientation="rows"
      cardWidth="w-[300px]"
    />
  );
}
