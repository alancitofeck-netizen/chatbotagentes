"use client";

import { useState } from "react";
import { ShieldCheck, Plus, FileUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { PolicyDetail } from "@/lib/policies/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getPolicyBoardAction, deletePolicyAction, type PolicyBoard } from "@/lib/policies/actions";
import { PoliciesKpiHeader } from "./PoliciesKpiHeader";
import { PolicyKanban } from "./PolicyKanban";
import { PolicyFormSheet } from "./PolicyFormSheet";
import { PolicyDetailSheet } from "./PolicyDetailSheet";
import { PolicyPdfUploadSheet } from "./PolicyPdfUploadSheet";

export function PoliciesBoardShell({
  workspaceId,
  initialBoard,
  members,
}: {
  workspaceId: string;
  initialBoard: PolicyBoard;
  members: WorkspaceMemberOption[];
}) {
  const [board, setBoard] = useState(initialBoard);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState<{ policy: PolicyDetail | null } | null>(null);
  const [pdfUploadOpen, setPdfUploadOpen] = useState(false);

  const hasPolicies = Object.values(board.cardsByStage).some((cards) => cards.length > 0);

  async function refreshBoard() {
    const fresh = await getPolicyBoardAction();
    setBoard(fresh);
  }

  async function handleDeleteFromDetail(id: string) {
    if (!window.confirm("¿Eliminar esta póliza? Esta acción no se puede deshacer.")) return;
    await deletePolicyAction(id);
    toast.success("Póliza eliminada.");
    setDetailId(null);
    refreshBoard();
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {!hasPolicies ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={ShieldCheck}
            title="Todavía no hay pólizas cargadas"
            description="Creá tu primera póliza a mano o subí un PDF para que la IA la lea por vos."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button onClick={() => setPolicyForm({ policy: null })}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nueva póliza
                </Button>
                <Button variant="secondary" onClick={() => setPdfUploadOpen(true)}>
                  <FileUp className="size-4" aria-hidden="true" />
                  Subir PDF
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
            <PoliciesKpiHeader kpis={board.kpis} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button onClick={() => setPolicyForm({ policy: null })}>
                <Plus className="size-4" aria-hidden="true" />
                Nueva póliza
              </Button>
              <Button variant="secondary" onClick={() => setPdfUploadOpen(true)}>
                <FileUp className="size-4" aria-hidden="true" />
                Subir PDF
              </Button>
            </div>
          </div>

          <PolicyKanban stages={board.stages} cardsByStage={board.cardsByStage} onOpen={(card) => setDetailId(card.id)} onChanged={refreshBoard} />
        </>
      )}

      <PolicyDetailSheet
        key={detailId ?? "closed"}
        policyId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(policy) => {
          setPolicyForm({ policy });
          setDetailId(null);
        }}
        onDelete={handleDeleteFromDetail}
      />

      {policyForm && (
        <PolicyFormSheet
          policy={policyForm.policy}
          members={members}
          onClose={() => setPolicyForm(null)}
          onSaved={refreshBoard}
        />
      )}

      {pdfUploadOpen && (
        <PolicyPdfUploadSheet workspaceId={workspaceId} onClose={() => setPdfUploadOpen(false)} onSaved={refreshBoard} />
      )}
    </div>
  );
}
