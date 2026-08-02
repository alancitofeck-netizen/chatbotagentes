"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Fab } from "@/components/ui/Fab";
import { KanbanSquare, Settings } from "lucide-react";
import { toast } from "@/components/toast/toast";
import type { CrmBoard, CrmPipelineOption, OpportunityCard, OpportunityTag } from "@/lib/crm/queries";
import type { AgentListItem } from "@/lib/agents/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import {
  getCrmBoardAction,
  getCrmPipelinesAction,
  deleteOpportunity,
  bulkMoveOpportunities,
  bulkDeleteOpportunities,
  bulkAssignOwner,
  bulkAddTag,
  exportOpportunitiesCsv,
  ensureCrmPipelineAction,
  createPipeline,
} from "@/lib/crm/actions";
import { filterAndSortBoard } from "@/lib/crm/boardFilters";
import { BoardActionBar, EMPTY_FILTERS, type BoardFilters, type SortOption } from "./BoardActionBar";
import { BoardKpiHeader } from "./BoardKpiHeader";
import { KanbanBoard } from "./KanbanBoard";
import { OpportunityTable } from "./OpportunityTable";
import { CardDetailSheet } from "./CardDetailSheet";
import { LeadFormSheet } from "./LeadFormSheet";
import { ImportLeadsSheet } from "./ImportLeadsSheet";
import { ManagePipelineSheet } from "./ManagePipelineSheet";

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Orchestrates the enriched CRM board: owns the board's client-side state
 * (refetched via getCrmBoardAction after every mutation, same pattern as
 * AgentsList.tsx), search/filters/sort/selection, and which sheet is open.
 * Kanban and Tabla both read from the same `filterAndSortBoard` result so
 * they never disagree on "what matches the current filters". */
export function CrmBoardShell({
  initialBoard,
  initialPipelines,
  members,
  agents,
  tags,
  onBoardChange,
}: {
  initialBoard: CrmBoard | null;
  initialPipelines: CrmPipelineOption[];
  members: WorkspaceMemberOption[];
  agents: AgentListItem[];
  tags: OpportunityTag[];
  /** CrmPageShell also renders Analytics from the same board — this keeps
   * that sibling tab in sync after a client-side mutation here (e.g.
   * creating the pipeline) without requiring a full page reload. */
  onBoardChange?: (board: CrmBoard | null) => void;
}) {
  const [board, setBoardState] = useState(initialBoard);
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [manageOpen, setManageOpen] = useState(false);
  function setBoard(next: CrmBoard | null) {
    setBoardState(next);
    onBoardChange?.(next);
  }
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  // Deep link from outside the board — e.g. the "Link al lead" embedded in a
  // close-date calendar event's description (src/lib/crm/calendarSync.ts).
  // Read once as the lazy initial state (not an effect — setState-in-effect
  // is flagged by this project's lint rules, and this only ever needs to
  // seed the initial value, never react to later URL changes).
  const [detailState, setDetailState] = useState<{ id: string; tab: "resumen" | "notas" } | null>(() => {
    const opportunityId = searchParams.get("opportunity");
    return opportunityId ? { id: opportunityId, tab: "resumen" } : null;
  });
  const [leadForm, setLeadForm] = useState<{ card: OpportunityCard | null; defaultStageId: string | null } | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [isCreatingPipeline, startCreatePipeline] = useTransition();

  function handleCreatePipeline() {
    startCreatePipeline(async () => {
      try {
        const fresh = await ensureCrmPipelineAction();
        setBoard(fresh);
        if (fresh) setPipelines((prev) => (prev.some((p) => p.id === fresh.pipelineId) ? prev : [...prev, { id: fresh.pipelineId, name: fresh.pipelineName }]));
        toast.success("Pipeline de ventas creado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el pipeline de ventas.");
      }
    });
  }

  const supervisorByOwnerId = useMemo(
    () => new Map(agents.map((a) => [a.memberId, a.supervisorId])),
    [agents],
  );
  const supervisors = useMemo(
    () => agents.filter((a) => agents.some((b) => b.supervisorId === a.memberId)).map((a) => ({ memberId: a.memberId, fullName: a.fullName, avatarUrl: a.avatarUrl })),
    [agents],
  );

  const allCards = useMemo(() => (board ? Object.values(board.cardsByStage).flat() : []), [board]);
  const cardById = useMemo(() => new Map(allCards.map((c) => [c.id, c])), [allCards]);
  const sources = useMemo(
    () => Array.from(new Set(allCards.map((c) => c.source).filter((s): s is string => Boolean(s)))).sort(),
    [allCards],
  );
  const companies = useMemo(
    () => Array.from(new Set(allCards.map((c) => c.company).filter((s): s is string => Boolean(s)))).sort(),
    [allCards],
  );
  const avgOpenValue = useMemo(() => {
    if (!board) return 0;
    const open = allCards.filter((c) => {
      const stage = board.stages.find((s) => s.id === c.stageId);
      return stage && !stage.isWon && !stage.isLost;
    });
    return open.length ? open.reduce((sum, c) => sum + c.value, 0) / open.length : 0;
  }, [board, allCards]);

  const filtered = useMemo(
    () => (board ? filterAndSortBoard(board, { search, filters, sortBy, supervisorByOwnerId }) : null),
    [board, search, filters, sortBy, supervisorByOwnerId],
  );

  async function refreshBoard() {
    const fresh = await getCrmBoardAction(board?.pipelineId);
    setBoard(fresh);
  }

  function handleSwitchPipeline(pipelineId: string) {
    startCreatePipeline(async () => {
      const fresh = await getCrmBoardAction(pipelineId);
      setBoard(fresh);
    });
  }

  function handleCreateNewPipeline() {
    const name = window.prompt("Nombre del nuevo pipeline:");
    if (!name || !name.trim()) return;
    startCreatePipeline(async () => {
      try {
        const { id } = await createPipeline(name);
        setPipelines((prev) => [...prev, { id, name: name.trim() }]);
        const fresh = await getCrmBoardAction(id);
        setBoard(fresh);
        toast.success("Pipeline creado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el pipeline.");
      }
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectionMode() {
    setSelectionMode((v) => !v);
    clearSelection();
  }

  function selectedCards() {
    return Array.from(selectedIds)
      .map((id) => cardById.get(id))
      .filter((c): c is OpportunityCard => Boolean(c));
  }

  async function handleBulkMoveStage(stageId: string) {
    const cards = selectedCards();
    await bulkMoveOpportunities(
      cards.map((c) => c.pipelineItemId),
      stageId,
    );
    toast.success(`${cards.length} lead(s) movido(s).`);
    clearSelection();
    refreshBoard();
  }

  async function handleBulkAssignOwner(ownerId: string | null) {
    const cards = selectedCards();
    await bulkAssignOwner(
      cards.map((c) => c.id),
      ownerId,
    );
    toast.success(`Agente asignado a ${cards.length} lead(s).`);
    clearSelection();
    refreshBoard();
  }

  async function handleBulkAddTag(tagId: string) {
    const cards = selectedCards();
    await bulkAddTag(
      cards.map((c) => c.contactId),
      tagId,
    );
    toast.success(`Etiqueta agregada a ${cards.length} lead(s).`);
    refreshBoard();
  }

  async function handleBulkDelete() {
    const cards = selectedCards();
    if (!window.confirm(`¿Eliminar ${cards.length} lead(s)? Esta acción no se puede deshacer.`)) return;
    await bulkDeleteOpportunities(cards.map((c) => c.id));
    toast.success(`${cards.length} lead(s) eliminado(s).`);
    clearSelection();
    setSelectionMode(false);
    refreshBoard();
  }

  async function handleDeleteOne(card: OpportunityCard) {
    if (!window.confirm(`¿Eliminar "${card.title}"? Esta acción no se puede deshacer.`)) return;
    await deleteOpportunity(card.id);
    toast.success("Lead eliminado.");
    refreshBoard();
  }

  function handleNewLead() {
    setLeadForm({ card: null, defaultStageId: board?.stages[0]?.id ?? null });
  }

  async function handleExport() {
    const csv = await exportOpportunitiesCsv();
    if (!csv) {
      toast.error("No hay datos para exportar.");
      return;
    }
    downloadCsv(csv);
  }

  async function handlePipelineManagementChanged() {
    const [freshBoard, freshPipelines] = await Promise.all([
      getCrmBoardAction(board?.pipelineId),
      getCrmPipelinesAction(),
    ]);
    setBoard(freshBoard);
    setPipelines(freshPipelines);
  }

  if (!board || !filtered) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState
          icon={KanbanSquare}
          title="Todavía no hay un pipeline de ventas"
          description="Creá el pipeline para empezar a cargar oportunidades — arranca con un set de etapas estándar que después podés editar libremente."
          action={
            <Button onClick={handleCreatePipeline} loading={isCreatingPipeline}>
              Crear pipeline de ventas
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          {pipelines.length > 1 ? (
            <Select
              label="Pipeline"
              containerClassName="w-64"
              value={board.pipelineId}
              onChange={(e) => (e.target.value === "__new__" ? handleCreateNewPipeline() : handleSwitchPipeline(e.target.value))}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="__new__">+ Nuevo pipeline…</option>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{board.pipelineName}</p>
              <button
                type="button"
                onClick={handleCreateNewPipeline}
                className="text-xs font-medium text-accent-600 hover:underline"
              >
                + Nuevo pipeline
              </button>
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={() => setManageOpen(true)}>
            <Settings size={14} aria-hidden="true" />
            Gestionar pipeline
          </Button>
        </div>
        <BoardKpiHeader kpis={board.kpis} />
        <BoardActionBar
          view={view}
          onViewChange={setView}
          search={search}
          onSearchChange={setSearch}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filters={filters}
          onFiltersChange={setFilters}
          stages={board.stages}
          members={members}
          supervisors={supervisors}
          tags={tags}
          sources={sources}
          companies={companies}
          selectionMode={selectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          selectedCount={selectedIds.size}
          onNewLead={handleNewLead}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
          onBulkMoveStage={handleBulkMoveStage}
          onBulkAssignOwner={handleBulkAssignOwner}
          onBulkAddTag={handleBulkAddTag}
          onBulkDelete={handleBulkDelete}
        />
      </div>

      {/* No fixed-height/overflow-hidden box here on purpose — the board grows
         naturally (stages stacked top-to-bottom, see KanbanBoard's orientation="rows")
         and the page itself scrolls (via the (protected) layout's <main overflow-y-auto>),
         instead of confining everything to a small internally-scrolling strip.
         Below `sm`, KanbanBoard switches itself to horizontal-scrolling columns
         with real touch drag-and-drop (see src/app/(protected)/crm/KanbanBoard.tsx
         useIsMobile), so it's shown regardless of the desktop kanban/tabla toggle —
         a wide table is never the right mobile view, the touch-friendly kanban is. */}
      {view === "kanban" ? (
        <KanbanBoard
          stages={board.stages}
          cardsByStage={filtered.cardsByStage}
          avgOpenValue={avgOpenValue}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={(card) => setDetailState({ id: card.id, tab: "resumen" })}
          onEdit={(card) => setLeadForm({ card, defaultStageId: null })}
          onNote={(card) => setDetailState({ id: card.id, tab: "notas" })}
          onChanged={refreshBoard}
        />
      ) : (
        <>
          <div className="hidden px-4 pb-4 sm:block sm:px-6 lg:px-8">
            <OpportunityTable
              cards={filtered.flat}
              stages={board.stages}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onOpen={(card) => setDetailState({ id: card.id, tab: "resumen" })}
              onEdit={(card) => setLeadForm({ card, defaultStageId: null })}
              onDelete={handleDeleteOne}
            />
          </div>
          <div className="sm:hidden">
            <KanbanBoard
              stages={board.stages}
              cardsByStage={filtered.cardsByStage}
              avgOpenValue={avgOpenValue}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onOpen={(card) => setDetailState({ id: card.id, tab: "resumen" })}
              onEdit={(card) => setLeadForm({ card, defaultStageId: null })}
              onNote={(card) => setDetailState({ id: card.id, tab: "notas" })}
              onChanged={refreshBoard}
            />
          </div>
        </>
      )}

      <Fab aria-label="Nuevo lead" title="Nuevo lead" onClick={handleNewLead} />

      <CardDetailSheet
        key={detailState?.id ?? "closed"}
        opportunityId={detailState?.id ?? null}
        initialTab={detailState?.tab}
        onClose={() => setDetailState(null)}
        onEdit={() => {
          const card = detailState ? cardById.get(detailState.id) : null;
          if (card) setLeadForm({ card, defaultStageId: null });
          setDetailState(null);
        }}
      />

      {leadForm && (
        <LeadFormSheet
          card={leadForm.card}
          stages={board.stages}
          defaultStageId={leadForm.defaultStageId}
          members={members}
          tags={tags}
          onClose={() => setLeadForm(null)}
          onSaved={refreshBoard}
        />
      )}

      {importOpen && (
        <ImportLeadsSheet
          onClose={() => setImportOpen(false)}
          onImported={() => {
            refreshBoard();
          }}
        />
      )}

      {manageOpen && (
        <ManagePipelineSheet
          pipelineId={board.pipelineId}
          pipelineName={board.pipelineName}
          stages={board.stages}
          onClose={() => setManageOpen(false)}
          onChanged={handlePipelineManagementChanged}
        />
      )}
    </div>
  );
}
