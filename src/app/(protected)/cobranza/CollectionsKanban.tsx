"use client";

import { KanbanBoard as GenericKanbanBoard, type KanbanCardBase } from "@/components/kanban/KanbanBoard";
import { toast } from "@/components/toast/toast";
import type { CollectionItem } from "@/lib/collections/queries";
import { deriveCollectionBucket, COLLECTION_KANBAN_COLUMNS, type CollectionBucket, type CollectionStatus } from "@/lib/collections/constants";
import { updateCollectionStatusAction } from "@/lib/collections/actions";
import { formatCurrency } from "@/lib/utils/format";

interface CollectionCard extends KanbanCardBase, CollectionItem {}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function CollectionCardView({ card, onOpen }: { card: CollectionCard; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 rounded-lg bg-surface-1 p-3 text-left shadow-[var(--elevation-xs)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--elevation-sm)]"
    >
      <p className="truncate text-sm font-medium text-foreground">{card.contactName}</p>
      <p className="truncate text-xs text-neutral-500">
        {card.company}
        {card.policyNumber ? ` · ${card.policyNumber}` : ""}
      </p>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-foreground">{formatCurrency(card.amount, card.currency)}</span>
        <span className="text-xs text-neutral-400">{formatDate(card.dueDate)}</span>
      </div>
    </button>
  );
}

/** Kanban de Cobranza — reusa el KanbanBoard genérico de @dnd-kit con
 * "etapas" virtuales (COLLECTION_KANBAN_COLUMNS) en vez de pipeline_stages
 * reales, ya que policy_payments no tiene pipeline propio. "proximo" y
 * "vencido" son columnas derivadas, no destino válido de un drag — si el
 * usuario suelta ahí, se revierte con un toast y un refetch completo
 * (remonta con `key`, ver CollectionsShell). */
export function CollectionsKanban({
  items,
  onOpen,
  onChanged,
}: {
  items: CollectionItem[];
  onOpen: (item: CollectionItem) => void;
  onChanged: () => void;
}) {
  const stages = COLLECTION_KANBAN_COLUMNS.map((c, i) => ({ id: c.key, name: c.label, position: i }));

  const cardsByStage: Record<string, CollectionCard[]> = {};
  for (const col of COLLECTION_KANBAN_COLUMNS) cardsByStage[col.key] = [];
  for (const item of items) {
    const bucket = deriveCollectionBucket(item.status, item.dueDate);
    cardsByStage[bucket].push({ ...item, pipelineItemId: item.id, stageId: bucket, position: 0 });
  }

  function handleMove(pipelineItemId: string, stageId: string) {
    const target = stageId as CollectionBucket;
    if (target === "proximo" || target === "vencido") {
      toast.error("Esa columna se calcula sola por fecha — no se puede mover un cobro ahí a mano.");
      onChanged();
      return;
    }
    updateCollectionStatusAction(pipelineItemId, target as CollectionStatus)
      .then(onChanged)
      .catch(() => {
        toast.error("No se pudo mover el cobro. Intentá de nuevo.");
        onChanged();
      });
  }

  return (
    <GenericKanbanBoard<CollectionCard>
      stages={stages}
      initialCardsByStage={cardsByStage}
      renderCard={(card, onOpenDefault) => <CollectionCardView card={card} onOpen={onOpenDefault} />}
      onOpenCard={onOpen}
      onMove={handleMove}
      columnValueLabel={(cards) => {
        const total = cards.reduce((sum, c) => sum + c.amount, 0);
        return total > 0 ? formatCurrency(total) : undefined;
      }}
      orientation="rows"
      cardWidth="w-[280px]"
    />
  );
}
