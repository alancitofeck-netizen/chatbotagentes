"use client";

import { useState } from "react";
import { KanbanBoard as GenericKanbanBoard } from "@/components/kanban/KanbanBoard";
import type { CrmBoard, OpportunityCard } from "@/lib/crm/queries";
import { moveOpportunityCard } from "@/lib/crm/actions";
import { toast } from "@/components/toast/toast";
import { OpportunityCardView } from "./OpportunityCardView";
import { CardDetailSheet } from "./CardDetailSheet";

export function KanbanBoard({ board }: { board: CrmBoard }) {
  const [openOpportunityId, setOpenOpportunityId] = useState<string | null>(null);

  function handleMove(pipelineItemId: string, stageId: string, position: number) {
    moveOpportunityCard(pipelineItemId, stageId, position).catch(() => {
      toast.error("No se pudo mover la tarjeta. Intenta de nuevo.");
    });
  }

  return (
    <>
      <GenericKanbanBoard<OpportunityCard>
        stages={board.stages}
        initialCardsByStage={board.cardsByStage}
        renderCard={(card, onOpen) => <OpportunityCardView card={card} onOpen={onOpen} />}
        onOpenCard={(card) => setOpenOpportunityId(card.id)}
        onMove={handleMove}
        columnFooter={(cards) => {
          const total = cards.reduce((sum, c) => sum + c.value, 0);
          if (total <= 0) return null;
          return (
            <p className="px-1 font-mono text-xs text-neutral-500">
              {new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                total,
              )}
            </p>
          );
        }}
      />

      <CardDetailSheet
        key={openOpportunityId ?? "closed"}
        opportunityId={openOpportunityId}
        onClose={() => setOpenOpportunityId(null)}
      />
    </>
  );
}
