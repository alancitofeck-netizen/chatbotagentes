"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageCircle, Phone, ListTodo, MoreHorizontal, Eye, Pencil, Mail, StickyNote, CalendarDays } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import type { OpportunityCard, PipelineStage } from "@/lib/crm/queries";
import { formatCurrency } from "@/lib/utils/format";

const PRIORITY_LABEL: Record<OpportunityCard["priority"], string> = { high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_VARIANT: Record<OpportunityCard["priority"], "error" | "warning" | "neutral"> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

/** Card compacta de lead para el Kanban — misma data/acciones que antes
 * (drag&drop, abrir, editar, nota), solo mucho más densa: 3 acciones
 * rápidas siempre visibles (WhatsApp/Llamar/Tarea) + el resto (Ver/
 * Editar/Nota/Email/Calendario) en un menú "Más" que aparece al hover,
 * en vez de una fila larga de íconos todo el tiempo. */
export function OpportunityCardView({
  card,
  stages,
  avgOpenValue,
  selectionMode,
  selected,
  onToggleSelect,
  onOpen,
  onEdit,
  onNote,
  onTask,
}: {
  card: OpportunityCard;
  stages: PipelineStage[];
  avgOpenValue: number;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onNote: () => void;
  onTask: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.pipelineItemId,
  });

  const stage = stages.find((s) => s.id === card.stageId);
  const isHighValue = avgOpenValue > 0 && card.value >= avgOpenValue * 1.5;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-xs)] transition-all duration-200 hover:border-border-strong hover:shadow-[var(--elevation-sm)] ${
        isDragging ? "opacity-40" : ""
      } ${selected ? "ring-2 ring-accent-500" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          {...(selectionMode ? {} : { ...attributes, ...listeners })}
          className={`flex flex-1 items-center gap-2 text-left ${selectionMode ? "" : "cursor-grab active:cursor-grabbing"}`}
        >
          <Avatar name={card.contactName} src={card.contactAvatarUrl} size={26} />
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight text-foreground">{card.contactName}</p>
        </button>
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--color-accent-500)]"
          />
        ) : (
          <Badge variant={PRIORITY_VARIANT[card.priority]}>{PRIORITY_LABEL[card.priority]}</Badge>
        )}
      </div>

      <p className="truncate text-xs text-neutral-500">
        {card.title}
        {isHighValue && " · 💰 Alto potencial"}
      </p>

      <p className="font-mono text-[15px] font-semibold text-foreground">{formatCurrency(card.value, card.currency)}</p>

      <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <Avatar name={card.ownerName ?? "Sin asignar"} src={card.ownerAvatarUrl} size={16} />
          <span className="truncate">{card.ownerName ?? "Sin asignar"}</span>
        </span>
        {stage?.isLost ? (
          <span className="shrink-0 text-error-strong">Perdido</span>
        ) : card.daysSinceActivity !== null ? (
          <span className="shrink-0">{card.daysSinceActivity === 0 ? "Hoy" : `${card.daysSinceActivity}d sin actividad`}</span>
        ) : null}
      </div>

      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <Badge key={tag.id} variant={tagBadgeVariant(tag.color)}>
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border-default pt-2">
        <div className="flex items-center gap-1">
          {card.phone && (
            <a
              href={waLink(card.phone)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="WhatsApp"
              aria-label="Enviar WhatsApp"
              className="flex size-6 items-center justify-center rounded-md text-neutral-400 hover:bg-success-bg hover:text-success-strong"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
            </a>
          )}
          {card.phone && (
            <a
              href={`tel:${card.phone}`}
              onClick={(e) => e.stopPropagation()}
              title="Llamar"
              aria-label="Llamar"
              className="flex size-6 items-center justify-center rounded-md text-neutral-400 hover:bg-accent-100 hover:text-accent-700"
            >
              <Phone className="size-3.5" aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTask();
            }}
            title="Crear tarea"
            aria-label="Crear tarea"
            className="flex size-6 items-center justify-center rounded-md text-neutral-400 hover:bg-accent-100 hover:text-accent-700"
          >
            <ListTodo className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <DropdownMenu
            trigger={<MoreHorizontal className="size-3.5" aria-hidden="true" />}
            triggerLabel="Más acciones"
            triggerClassName="flex size-6 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-foreground"
            items={[
              { label: "Ver lead", icon: <Eye size={14} aria-hidden="true" />, onSelect: onOpen },
              { label: "Editar", icon: <Pencil size={14} aria-hidden="true" />, onSelect: onEdit },
              { label: "Agregar nota", icon: <StickyNote size={14} aria-hidden="true" />, onSelect: onNote },
              ...(card.email
                ? [{ label: "Enviar email", icon: <Mail size={14} aria-hidden="true" />, onSelect: () => window.open(`mailto:${card.email}`) }]
                : []),
              ...(card.expectedCloseDate
                ? [
                    {
                      label: "Ver en calendario",
                      icon: <CalendarDays size={14} aria-hidden="true" />,
                      onSelect: () =>
                        window.open(
                          `/calendar?view=day&date=${card.expectedCloseDate}${card.calendarEventId ? `&event=${card.calendarEventId}` : ""}`,
                          "_self",
                        ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
