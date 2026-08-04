"use client";

import { KanbanBoard as GenericKanbanBoard } from "@/components/kanban/KanbanBoard";
import type { PolicyListItem } from "@/lib/policies/queries";
import { movePolicyStageAction } from "@/lib/policies/actions";
import { toast } from "@/components/toast/toast";
import { formatCurrency } from "@/lib/utils/format";
import { PolicyCardView } from "./PolicyCardView";

export function PolicyKanban({
  stages,
  cardsByStage,
  onOpen,
  onChanged,
}: {
  stages: { id: string; name: string; position: number }[];
  cardsByStage: Record<string, PolicyListItem[]>;
  onOpen: (card: PolicyListItem) => void;
  onChanged: () => void;
}) {
  function handleMove(pipelineItemId: string, stageId: string, position: number) {
    movePolicyStageAction(pipelineItemId, stageId, position)
      .then(onChanged)
      .catch(() => toast.error("No se pudo mover la póliza. Intenta de nuevo."));
  }

  return (
    <GenericKanbanBoard<PolicyListItem>
      stages={stages}
      initialCardsByStage={cardsByStage}
      renderCard={(card, onOpenDefault) => <PolicyCardView card={card} onOpen={onOpenDefault} />}
      onOpenCard={onOpen}
      onMove={handleMove}
      columnValueLabel={(cards) => {
        const total = cards.reduce((sum, c) => sum + (c.premium ?? 0), 0);
        return total > 0 ? formatCurrency(total) : undefined;
      }}
      orientation="rows"
      cardWidth="w-[300px]"
    />
  );
}
