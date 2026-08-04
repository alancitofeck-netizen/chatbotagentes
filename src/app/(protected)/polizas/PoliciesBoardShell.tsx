"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Plus, FileUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { PolicyDetail, PolicyListItem } from "@/lib/policies/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import {
  getPolicyBoardAction,
  getPolicyByIdAction,
  deletePolicyAction,
  duplicatePolicyAction,
  movePolicyStageAction,
  type PolicyBoard,
} from "@/lib/policies/actions";
import { filterAndSortPolicyBoard, EMPTY_POLICIES_FILTERS, type PoliciesFilters, type PolicyQuickFilter } from "@/lib/policies/boardFilters";
import { PoliciesActionBar } from "./PoliciesActionBar";
import { PoliciesKpiHeader } from "./PoliciesKpiHeader";
import { PolicyTable } from "./PolicyTable";
import { PolicyKanban } from "./PolicyKanban";
import { PolicyCalendarView } from "./PolicyCalendarView";
import { PolicyFormSheet } from "./PolicyFormSheet";
import { PolicyDetailSheet, type DetailTab } from "./PolicyDetailSheet";
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
  const [view, setView] = useState<"table" | "kanban" | "calendar">("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PoliciesFilters>(EMPTY_POLICIES_FILTERS);
  const [quickFilter, setQuickFilter] = useState<PolicyQuickFilter>("all");
  const [detailState, setDetailState] = useState<{ id: string; tab?: DetailTab } | null>(null);
  const [policyForm, setPolicyForm] = useState<{ policy: PolicyDetail | null } | null>(null);
  const [pdfUploadOpen, setPdfUploadOpen] = useState(false);

  const hasPolicies = Object.values(board.cardsByStage).some((cards) => cards.length > 0);
  const companies = useMemo(() => board.kpis.byCompany.map((c) => c.company), [board.kpis.byCompany]);
  const cancelStageId = useMemo(() => board.stages.find((s) => s.name === "Cancelada")?.id ?? null, [board.stages]);

  const filtered = useMemo(
    () => filterAndSortPolicyBoard(board, { search, filters, quickFilter }),
    [board, search, filters, quickFilter],
  );

  async function refreshBoard() {
    const fresh = await getPolicyBoardAction();
    setBoard(fresh);
  }

  async function handleDeleteFromDetail(id: string) {
    if (!window.confirm("¿Eliminar esta póliza? Esta acción no se puede deshacer.")) return;
    await deletePolicyAction(id);
    toast.success("Póliza eliminada.");
    setDetailState(null);
    refreshBoard();
  }

  async function handleDuplicate(policy: PolicyListItem) {
    const { id } = await duplicatePolicyAction(policy.id);
    toast.success("Póliza duplicada — revisá los datos antes de emitirla.");
    await refreshBoard();
    setDetailState({ id, tab: "resumen" });
  }

  async function handleCancel(policy: PolicyListItem) {
    if (!cancelStageId) return;
    if (!window.confirm(`¿Marcar la póliza de ${policy.contactName} como cancelada?`)) return;
    await movePolicyStageAction(policy.pipelineItemId, cancelStageId);
    toast.success("Póliza cancelada.");
    refreshBoard();
  }

  async function handleEditFromTable(policy: PolicyListItem) {
    const detail = await getPolicyByIdAction(policy.id);
    setPolicyForm({ policy: detail });
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
            <PoliciesKpiHeader kpis={board.kpis} quickFilter={quickFilter} onQuickFilterChange={setQuickFilter} />
            <PoliciesActionBar
              view={view}
              onViewChange={setView}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFiltersChange={setFilters}
              companies={companies}
              members={members}
              onNewPolicy={() => setPolicyForm({ policy: null })}
              onUploadPdf={() => setPdfUploadOpen(true)}
            />
          </div>

          {view === "table" && (
            <div className="px-4 sm:px-6 lg:px-8">
              <PolicyTable
                policies={filtered.flat}
                onOpen={(policy) => setDetailState({ id: policy.id, tab: "resumen" })}
                onOpenDocuments={(policy) => setDetailState({ id: policy.id, tab: "documentos" })}
                onEdit={handleEditFromTable}
                onDuplicate={handleDuplicate}
                onCancel={handleCancel}
              />
            </div>
          )}
          {view === "kanban" && (
            <PolicyKanban
              stages={board.stages}
              cardsByStage={filtered.cardsByStage}
              onOpen={(card) => setDetailState({ id: card.id, tab: "resumen" })}
              onChanged={refreshBoard}
            />
          )}
          {view === "calendar" && (
            <div className="px-4 sm:px-6 lg:px-8">
              <PolicyCalendarView policies={filtered.flat} onOpen={(policy) => setDetailState({ id: policy.id, tab: "resumen" })} />
            </div>
          )}
        </>
      )}

      <PolicyDetailSheet
        key={detailState?.id ?? "closed"}
        policyId={detailState?.id ?? null}
        initialTab={detailState?.tab}
        onClose={() => setDetailState(null)}
        onEdit={(policy) => {
          setPolicyForm({ policy });
          setDetailState(null);
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
