"use client";

import { MessageCircle, Phone, MoreHorizontal, Eye, Pencil, Trash2, Rows3 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OpportunityCard, PipelineStage } from "@/lib/crm/queries";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/format";

const PRIORITY_LABEL: Record<OpportunityCard["priority"], string> = { high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_VARIANT: Record<OpportunityCard["priority"], "error" | "warning" | "neutral"> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

/** "Vista Lista" — filas de una sola línea, más densas que la Tabla (menos
 * columnas visibles: etapa/valor/prioridad/agente/última actividad, sin una
 * columna por cada dato secundario) pensada para escanear muchos leads
 * rápido. Misma data ya filtrada/ordenada que Kanban/Tabla
 * (filterAndSortBoard, boardFilters.ts) — ningún query nuevo. */
export function OpportunityListView({
  cards,
  stages,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpen,
  onEdit,
  onNote,
  onDelete,
}: {
  cards: OpportunityCard[];
  stages: PipelineStage[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (card: OpportunityCard) => void;
  onEdit: (card: OpportunityCard) => void;
  onNote: (card: OpportunityCard) => void;
  onDelete: (card: OpportunityCard) => void;
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  if (cards.length === 0) {
    return <EmptyState icon={Rows3} title="Sin resultados" description="Ningún lead coincide con los filtros aplicados." />;
  }

  return (
    <div className="flex flex-col divide-y divide-border-default rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-xs)]">
      {cards.map((card) => {
        const stage = stageById.get(card.stageId);
        return (
          <div key={card.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2">
            {selectionMode && (
              <input
                type="checkbox"
                checked={selectedIds.has(card.id)}
                onChange={() => onToggleSelect(card.id)}
                className="size-4 shrink-0 rounded border-border-strong accent-[var(--color-accent-500)]"
              />
            )}
            <button type="button" onClick={() => onOpen(card)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <Avatar name={card.contactName} src={card.contactAvatarUrl} size={26} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium leading-tight text-foreground">{card.contactName}</p>
                <p className="truncate text-[11.5px] leading-tight text-neutral-500">{card.company ?? card.title}</p>
              </div>
            </button>

            {stage && (
              <span className="hidden shrink-0 items-center gap-1.5 text-xs text-neutral-500 sm:flex">
                <span className={`size-1.5 rounded-full ${stage.isWon ? "bg-success" : stage.isLost ? "bg-error" : "bg-accent-500"}`} />
                {stage.name}
              </span>
            )}

            <span className="hidden w-24 shrink-0 text-right font-mono text-[13px] font-semibold text-foreground md:block">
              {formatCurrency(card.value, card.currency)}
            </span>

            <span className="hidden w-16 shrink-0 lg:block">
              <Badge variant={PRIORITY_VARIANT[card.priority]}>{PRIORITY_LABEL[card.priority]}</Badge>
            </span>

            <span className="hidden w-28 shrink-0 items-center gap-1.5 truncate text-xs text-neutral-500 lg:flex">
              <Avatar name={card.ownerName ?? "Sin asignar"} src={card.ownerAvatarUrl} size={18} />
              <span className="truncate">{card.ownerName ?? "Sin asignar"}</span>
            </span>

            <span className="hidden w-28 shrink-0 truncate text-right text-[11px] text-neutral-400 xl:block">
              {card.lastContactAt ? formatRelativeTime(card.lastContactAt) : "Sin actividad"}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              {card.phone && (
                <a
                  href={waLink(card.phone)}
                  target="_blank"
                  rel="noreferrer"
                  title="WhatsApp"
                  aria-label="Enviar WhatsApp"
                  className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-success-bg hover:text-success-strong"
                >
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                </a>
              )}
              {card.phone && (
                <a
                  href={`tel:${card.phone}`}
                  title="Llamar"
                  aria-label="Llamar"
                  className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-accent-100 hover:text-accent-700"
                >
                  <Phone className="size-3.5" aria-hidden="true" />
                </a>
              )}
              <DropdownMenu
                trigger={<MoreHorizontal className="size-3.5" aria-hidden="true" />}
                triggerLabel="Más acciones"
                triggerClassName="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                items={[
                  { label: "Ver lead", icon: <Eye size={14} aria-hidden="true" />, onSelect: () => onOpen(card) },
                  { label: "Editar", icon: <Pencil size={14} aria-hidden="true" />, onSelect: () => onEdit(card) },
                  { label: "Agregar nota", icon: <MessageCircle size={14} aria-hidden="true" />, onSelect: () => onNote(card) },
                  { label: "Eliminar", icon: <Trash2 size={14} aria-hidden="true" />, destructive: true, onSelect: () => onDelete(card) },
                ]}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
