"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { OpportunityCard } from "@/lib/crm/queries";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function OpportunityCardView({ card, onOpen }: { card: OpportunityCard; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.pipelineItemId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={`cursor-grab flex flex-col gap-2 rounded-md border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-xs)] transition-shadow hover:shadow-[var(--elevation-sm)] active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="text-[13px] font-medium leading-snug text-foreground">{card.title}</p>
      {card.company && <p className="text-xs text-neutral-500">{card.company}</p>}
      <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(card.value, card.currency)}</p>
      <div className="flex items-center justify-between">
        <Avatar name={card.contactName} size={22} />
        {card.nextActivity && (
          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
            <CalendarClock className="size-3" aria-hidden="true" />
            {card.nextActivity.title}
          </span>
        )}
      </div>
    </div>
  );
}
