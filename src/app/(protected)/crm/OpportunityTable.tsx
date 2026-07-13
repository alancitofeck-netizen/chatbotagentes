"use client";

import { Eye, Pencil, Trash2, Table } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import type { OpportunityCard, PipelineStage } from "@/lib/crm/queries";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/format";

const PRIORITY_LABEL: Record<OpportunityCard["priority"], string> = { high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_VARIANT: Record<OpportunityCard["priority"], "error" | "warning" | "neutral"> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

/** "Vista Tabla" — same filtered/sorted data as the Kanban (owned by
 * CrmBoardShell), just rendered as a wide sortable-by-column table instead of
 * cards. Same overflow-x-auto + min-width pattern as AgentsList.tsx. */
export function OpportunityTable({
  cards,
  stages,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
  onEdit,
  onDelete,
}: {
  cards: OpportunityCard[];
  stages: PipelineStage[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (card: OpportunityCard) => void;
  onEdit: (card: OpportunityCard) => void;
  onDelete: (card: OpportunityCard) => void;
}) {
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));

  if (cards.length === 0) {
    return <EmptyState icon={Table} title="Sin resultados" description="Ningún lead coincide con los filtros aplicados." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs text-neutral-500">
            {selectionMode && <th className="w-10 px-3 py-2.5" />}
            <th className="px-3 py-2.5 font-medium">Lead</th>
            <th className="px-3 py-2.5 font-medium">Empresa</th>
            <th className="px-3 py-2.5 font-medium">Valor</th>
            <th className="px-3 py-2.5 font-medium">Prioridad</th>
            <th className="px-3 py-2.5 font-medium">Probabilidad</th>
            <th className="px-3 py-2.5 font-medium">Etapa</th>
            <th className="px-3 py-2.5 font-medium">Agente</th>
            <th className="px-3 py-2.5 font-medium">Etiquetas</th>
            <th className="px-3 py-2.5 font-medium">Última actividad</th>
            <th className="px-3 py-2.5 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
              {selectionMode && (
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(card.id)}
                    onChange={() => onToggleSelect(card.id)}
                    className="size-4 rounded border-border-strong accent-[var(--color-accent-500)]"
                  />
                </td>
              )}
              <td className="px-3 py-2.5">
                <button type="button" onClick={() => onOpen(card)} className="flex items-center gap-2 text-left hover:text-accent-700">
                  <Avatar name={card.contactName} src={card.contactAvatarUrl} size={28} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{card.contactName}</p>
                    <p className="truncate text-xs text-neutral-500">{card.title}</p>
                  </div>
                </button>
              </td>
              <td className="px-3 py-2.5 text-neutral-600">{card.company ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono">{formatCurrency(card.value, card.currency)}</td>
              <td className="px-3 py-2.5">
                <Badge variant={PRIORITY_VARIANT[card.priority]}>{PRIORITY_LABEL[card.priority]}</Badge>
              </td>
              <td className="px-3 py-2.5 text-neutral-600">{card.probability !== null ? `${card.probability}%` : "—"}</td>
              <td className="px-3 py-2.5 text-neutral-600">{stageNameById.get(card.stageId) ?? "—"}</td>
              <td className="px-3 py-2.5 text-neutral-600">{card.ownerName ?? "Sin asignar"}</td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {card.tags.map((tag) => (
                    <Badge key={tag.id} variant={tagBadgeVariant(tag.color)}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-neutral-500">
                {card.lastContactAt ? formatRelativeTime(card.lastContactAt) : "Sin actividad"}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 text-neutral-400">
                  <button type="button" onClick={() => onOpen(card)} title="Ver" className="hover:text-accent-700">
                    <Eye className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => onEdit(card)} title="Editar" className="hover:text-accent-700">
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => onDelete(card)} title="Eliminar" className="hover:text-error-strong">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
