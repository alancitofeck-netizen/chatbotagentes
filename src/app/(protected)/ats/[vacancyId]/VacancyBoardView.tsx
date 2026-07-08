"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { KanbanBoard as GenericKanbanBoard } from "@/components/kanban/KanbanBoard";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { CandidateCard, VacancyBoard } from "@/lib/ats/queries";
import { moveCandidateCard } from "@/lib/ats/actions";
import { CandidateCardView } from "./CandidateCardView";
import { CandidateDetailSheet } from "./CandidateDetailSheet";
import { AddCandidateSheet } from "./AddCandidateSheet";

export function VacancyBoardView({ board }: { board: VacancyBoard }) {
  const router = useRouter();
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  function handleMove(pipelineItemId: string, stageId: string, position: number) {
    moveCandidateCard(pipelineItemId, stageId, position).catch(() => {
      toast.error("No se pudo mover la tarjeta. Intenta de nuevo.");
    });
  }

  return (
    <>
      <div className="flex justify-end px-4 sm:px-6 lg:px-8">
        <Button size="sm" onClick={() => setAddSheetOpen(true)}>
          <UserPlus size={16} /> Agregar candidato
        </Button>
      </div>

      <GenericKanbanBoard<CandidateCard>
        stages={board.stages}
        initialCardsByStage={board.cardsByStage}
        renderCard={(card, onOpen) => <CandidateCardView card={card} onOpen={onOpen} />}
        onOpenCard={(card) => setOpenApplicationId(card.id)}
        onMove={handleMove}
      />

      <CandidateDetailSheet
        key={openApplicationId ?? "closed"}
        applicationId={openApplicationId}
        onClose={() => setOpenApplicationId(null)}
      />

      <AddCandidateSheet
        vacancyId={board.vacancy.id}
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdded={() => router.refresh()}
      />
    </>
  );
}
