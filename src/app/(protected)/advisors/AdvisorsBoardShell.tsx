"use client";

import { useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AdvisorsBoard, DealCard } from "@/lib/advisors/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getAdvisorsBoardAction, deleteDeal } from "@/lib/advisors/actions";
import { AdvisorsKpiHeader } from "./AdvisorsKpiHeader";
import { AdvisorsKanban } from "./AdvisorsKanban";
import { DealFormSheet } from "./DealFormSheet";
import { DealDetailSheet } from "./DealDetailSheet";

/** First-pass "Asesores" board — deliberately narrower than the CRM board
 * (no Tabla/bulk actions/CSV import-export/advanced filters): rich Kanban
 * cards, KPI header, create/edit/delete, drag & drop, notes. Can grow later
 * if the vertical gets real usage (see the approved plan). */
export function AdvisorsBoardShell({
  initialBoard,
  members,
}: {
  initialBoard: AdvisorsBoard | null;
  members: WorkspaceMemberOption[];
}) {
  const [board, setBoard] = useState(initialBoard);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState<{ card: DealCard | null; defaultStageId: string | null } | null>(null);

  async function refreshBoard() {
    const fresh = await getAdvisorsBoardAction();
    setBoard(fresh);
  }

  const cardById = new Map(
    board ? Object.values(board.cardsByStage).flat().map((c) => [c.id, c]) : [],
  );

  async function handleDeleteFromDetail(id: string) {
    if (!window.confirm("¿Eliminar esta póliza? Esta acción no se puede deshacer.")) return;
    await deleteDeal(id);
    toast.success("Póliza eliminada.");
    setDetailId(null);
    refreshBoard();
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {!board ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={ShieldCheck}
            title="Todavía no hay pólizas cargadas"
            description="Se crea automáticamente con tu primera póliza."
            action={
              <Button onClick={() => setDealForm({ card: null, defaultStageId: null })}>
                <Plus className="size-4" aria-hidden="true" />
                Nueva póliza
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
            <AdvisorsKpiHeader kpis={board.kpis} />
            <div>
              <Button onClick={() => setDealForm({ card: null, defaultStageId: board.stages[0]?.id ?? null })}>
                <Plus className="size-4" aria-hidden="true" />
                Nueva póliza
              </Button>
            </div>
          </div>

          <AdvisorsKanban
            stages={board.stages}
            cardsByStage={board.cardsByStage}
            onOpen={(card) => setDetailId(card.id)}
            onEdit={(card) => setDealForm({ card, defaultStageId: null })}
            onNote={(card) => setDetailId(card.id)}
            onChanged={refreshBoard}
          />
        </>
      )}

      <DealDetailSheet
        key={detailId ?? "closed"}
        opportunityId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          const card = detailId ? cardById.get(detailId) : null;
          if (card) setDealForm({ card, defaultStageId: null });
          setDetailId(null);
        }}
        onDelete={handleDeleteFromDetail}
      />

      {dealForm && (
        <DealFormSheet
          card={dealForm.card}
          stages={board?.stages ?? []}
          defaultStageId={dealForm.defaultStageId}
          members={members}
          onClose={() => setDealForm(null)}
          onSaved={refreshBoard}
        />
      )}
    </div>
  );
}
