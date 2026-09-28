"use client";

import { useMemo, useState } from "react";
import { KanbanBoard as GenericKanbanBoard } from "@/components/kanban/KanbanBoard";
import { toast } from "@/components/toast/toast";
import { updateMiniAppLeadStatus } from "@/lib/miniApps/actions";
import type { MiniAppLeadRow, MiniAppLeadStatus, MiniAppTemplateKey } from "@/lib/miniApps/queries";
import { getLeadResultValue } from "@/lib/miniApps/resultField";
import { formatCurrency } from "@/lib/utils/format";
import { MINI_APP_LEAD_VISIBLE_STAGES, MINI_APP_LEAD_DISCARDED_STAGE } from "./leadStatus";
import { MiniAppLeadKanbanCard, type MiniAppLeadKanbanCardData } from "./MiniAppLeadKanbanCard";

export function MiniAppLeadsKanban({
  leads,
  templateKey,
  onOpen,
  onChanged,
}: {
  leads: MiniAppLeadRow[];
  templateKey: MiniAppTemplateKey;
  onOpen: (leadId: string) => void;
  onChanged: () => void;
}) {
  const [showDiscarded, setShowDiscarded] = useState(false);
  const stages = showDiscarded ? [...MINI_APP_LEAD_VISIBLE_STAGES, MINI_APP_LEAD_DISCARDED_STAGE] : MINI_APP_LEAD_VISIBLE_STAGES;

  const cardsByStage = useMemo(() => {
    const map: Record<string, MiniAppLeadKanbanCardData[]> = {};
    for (const stage of stages) map[stage.id] = [];
    leads.forEach((lead, index) => {
      if (!map[lead.status]) return; // "discarded" con showDiscarded=false: no tiene columna, no se dibuja
      map[lead.status].push({ ...lead, pipelineItemId: lead.id, stageId: lead.status, position: index });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stages` depende de showDiscarded, ya cubierto abajo
  }, [leads, showDiscarded]);

  function handleMove(leadId: string, stageId: string) {
    updateMiniAppLeadStatus(leadId, stageId as MiniAppLeadStatus)
      .then(onChanged)
      .catch(() => toast.error("No se pudo mover el lead. Intentá de nuevo."));
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 px-4 text-xs text-neutral-500 sm:px-6 lg:px-8">
        <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} className="size-3.5 rounded border-border-default" />
        Mostrar leads descartados
      </label>
      <GenericKanbanBoard<MiniAppLeadKanbanCardData>
        stages={stages}
        initialCardsByStage={cardsByStage}
        renderCard={(card, onOpenDefault) => <MiniAppLeadKanbanCard card={card} templateKey={templateKey} onOpen={onOpenDefault} />}
        onOpenCard={(card) => onOpen(card.id)}
        onMove={handleMove}
        columnValueLabel={(cards) => {
          const total = cards.reduce((sum, c) => sum + (getLeadResultValue(templateKey, c.data) ?? 0), 0);
          return total > 0 ? formatCurrency(total, "MXN") : undefined;
        }}
        orientation="rows"
        cardWidth="w-[260px]"
      />
    </div>
  );
}
