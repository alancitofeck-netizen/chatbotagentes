"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { KanbanCardBase } from "@/components/kanban/KanbanBoard";
import type { MiniAppLeadRow, MiniAppTemplateKey } from "@/lib/miniApps/queries";
import { getLeadResultValue, getResultFieldSpec } from "@/lib/miniApps/resultField";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/format";

export interface MiniAppLeadKanbanCardData extends MiniAppLeadRow, KanbanCardBase {}

function formatResult(value: number, format: "currency" | "percent") {
  return format === "currency" ? formatCurrency(value, "MXN") : `${Math.round(value)}%`;
}

export function MiniAppLeadKanbanCard({ card, templateKey, onOpen }: { card: MiniAppLeadKanbanCardData; templateKey: MiniAppTemplateKey; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.pipelineItemId });
  const spec = getResultFieldSpec(templateKey);
  const resultValue = getLeadResultValue(templateKey, card.data);
  const digits = card.whatsapp.replace(/\D/g, "");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2.5 rounded-lg border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-xs)] transition-all duration-200 hover:shadow-[var(--elevation-sm)] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <button type="button" onClick={onOpen} {...attributes} {...listeners} className="flex flex-1 cursor-grab items-start gap-2.5 text-left active:cursor-grabbing">
        <Avatar name={card.nombre} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-snug text-foreground">{card.nombre}</p>
          <p className="truncate text-xs text-neutral-500">{card.whatsapp || card.nombre}</p>
        </div>
      </button>

      <div className="flex items-center justify-between gap-2">
        {spec && resultValue !== null ? (
          <p className="font-mono text-sm font-semibold text-foreground">{formatResult(resultValue, spec.format)}</p>
        ) : (
          <span className="text-xs text-neutral-400">{card.origenApp}</span>
        )}
        {digits.length >= 8 && (
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-default text-neutral-500 hover:bg-surface-2"
            title="Contactar por WhatsApp"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <p className="truncate text-xs text-neutral-400">
        {card.origenApp} · {formatRelativeTime(card.fecha)}
      </p>
    </div>
  );
}
