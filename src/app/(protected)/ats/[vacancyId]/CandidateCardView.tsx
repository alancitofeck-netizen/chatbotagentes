"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { CandidateCard } from "@/lib/ats/queries";

function formatRelativeDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

export function CandidateCardView({ card, onOpen }: { card: CandidateCard; onOpen: () => void }) {
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
      <div className="flex items-center gap-2">
        <Avatar name={card.contactName} src={card.contactAvatarUrl} size={28} />
        <p className="text-[13px] font-medium leading-snug text-foreground">{card.contactName}</p>
      </div>
      <div className="flex items-center justify-between">
        {card.source ? (
          <Badge variant="neutral" className="text-[10px]">
            {card.source}
          </Badge>
        ) : (
          <span />
        )}
        <span className="text-[11px] text-neutral-500">{formatRelativeDate(card.appliedAt)}</span>
      </div>
      {card.nextActivity && (
        <span className="flex items-center gap-1 text-[11px] text-neutral-500">
          <CalendarClock className="size-3" aria-hidden="true" />
          {card.nextActivity.title}
        </span>
      )}
    </div>
  );
}
