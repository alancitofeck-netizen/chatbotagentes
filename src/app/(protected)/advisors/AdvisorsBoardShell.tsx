"use client";

import { useState } from "react";
import { ShieldCheck, Plus, Upload, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { toast } from "@/components/toast/toast";
import type { AdvisorsBoard, DealCard } from "@/lib/advisors/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getAdvisorsBoardAction, deleteDeal } from "@/lib/advisors/actions";
import { AdvisorsKpiHeader } from "./AdvisorsKpiHeader";
import { AdvisorsKanban } from "./AdvisorsKanban";
import { DealFormSheet } from "./DealFormSheet";
import { DealDetailSheet } from "./DealDetailSheet";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

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
  useAutoStartTour("advisors-intro");
  const [board, setBoard] = useState(initialBoard);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Sube cuando una acción cambia el tablero desde afuera del arrastre (p. ej. "Avanzar etapa"):
  // el tablero genérico solo lee sus tarjetas al montarse, así que se vuelve a montar.
  const [boardVersion, setBoardVersion] = useState(0);
  const [dealForm, setDealForm] = useState<{ card: DealCard | null; defaultStageId: string | null } | null>(null);

  // Búsqueda local sobre lo que ya está cargado (nombre, empresa, título, contacto, tipo).
  const query = search.trim().toLowerCase();
  const visibleCardsByStage = !board || !query
    ? board?.cardsByStage
    : Object.fromEntries(
        Object.entries(board.cardsByStage).map(([stageId, cards]) => [
          stageId,
          cards.filter((c) =>
            [c.contactName, c.company, c.title, c.email, c.phone, c.policyType].some((v) => v?.toLowerCase().includes(query)),
          ),
        ]),
      );

  async function refreshBoard() {
    const fresh = await getAdvisorsBoardAction();
    setBoard(fresh);
  }

  const cardById = new Map(
    board ? Object.values(board.cardsByStage).flat().map((c) => [c.id, c]) : [],
  );

  async function handleDeleteFromDetail(id: string) {
    if (!window.confirm("¿Eliminar este prospecto? Esta acción no se puede deshacer.")) return;
    await deleteDeal(id);
    toast.success("Prospecto eliminado.");
    setDetailId(null);
    refreshBoard();
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {!board ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={ShieldCheck}
            title="Todavía no hay prospectos cargados"
            description="Se crea automáticamente con tu primer prospecto."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button onClick={() => setDealForm({ card: null, defaultStageId: null })}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nuevo prospecto
                </Button>
                <LinkButton href="/advisors/import" variant="secondary">
                  <Upload className="size-4" aria-hidden="true" />
                  Importar cartera
                </LinkButton>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
            <AdvisorsKpiHeader kpis={board.kpis} />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar prospecto, empresa o teléfono"
                aria-label="Buscar prospecto"
                className="w-full rounded-full border border-border-default bg-surface-1 py-2.5 pl-10 pr-4 text-base outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100 sm:py-2 sm:text-sm md:max-w-md"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button onClick={() => setDealForm({ card: null, defaultStageId: board.stages[0]?.id ?? null })} data-tour="advisors.new-button">
                <Plus className="size-4" aria-hidden="true" />
                Nuevo prospecto
              </Button>
              <LinkButton href="/advisors/import" variant="secondary" data-tour="advisors.import-link">
                <Upload className="size-4" aria-hidden="true" />
                Importar cartera
              </LinkButton>
            </div>
          </div>

          <AdvisorsKanban
            stages={board.stages}
            key={`${query}-${boardVersion}`}
            cardsByStage={visibleCardsByStage ?? board.cardsByStage}
            onOpen={(card) => setDetailId(card.id)}
            onEdit={(card) => setDealForm({ card, defaultStageId: null })}
            onNote={(card) => setDetailId(card.id)}
            onChanged={refreshBoard}
            onAdvanced={async () => {
              await refreshBoard();
              setBoardVersion((v) => v + 1);
            }}
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
