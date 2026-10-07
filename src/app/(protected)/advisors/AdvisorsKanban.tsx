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
  onAdvanced,
}: {
  stages: AdvisorStage[];
  cardsByStage: Record<string, DealCard[]>;
  onOpen: (card: DealCard) => void;
  onEdit: (card: DealCard) => void;
  onNote: (card: DealCard) => void;
  onChanged: () => void;
  /** Tras "Avanzar etapa": el tablero se vuelve a leer y a montar con la tarjeta ya movida. */
  onAdvanced: () => void;
}) {
  function handleMove(pipelineItemId: string, stageId: string, position: number) {
    moveDeal(pipelineItemId, stageId, position)
      .then(onChanged)
      .catch(() => toast.error("No se pudo mover la póliza. Intenta de nuevo."));
  }

  const orderedStages = [...stages].sort((a, b) => a.position - b.position);

  // "Avanzar etapa": la siguiente etapa abierta o ganada (nunca "perdida"); desde Ganado no hay más.
  function nextStageOf(card: DealCard) {
    const current = orderedStages.find((s) => s.id === card.stageId);
    if (!current || current.isWon || current.isLost) return null;
    return orderedStages.find((s) => s.position > current.position && !s.isLost) ?? null;
  }

  function handleAdvance(card: DealCard) {
    const next = nextStageOf(card);
    if (!next) return;
    moveDeal(card.pipelineItemId, next.id, cardsByStage[next.id]?.length ?? 0)
      .then(() => {
        toast.success(`${card.contactName} pasó a ${next.name}.`);
        onAdvanced();
      })
      .catch(() => toast.error("No se pudo avanzar el prospecto. Intenta de nuevo."));
  }

  return (
    <GenericKanbanBoard<DealCard>
      stages={stages}
      initialCardsByStage={cardsByStage}
      renderCard={(card, onOpenDefault) => (
        <DealCardView
          card={card}
          onOpen={onOpenDefault}
          onEdit={() => onEdit(card)}
          onNote={() => onNote(card)}
          nextStageName={nextStageOf(card)?.name ?? null}
          onAdvance={() => handleAdvance(card)}
        />
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
