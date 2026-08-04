"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, FileText } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { PolicyListItem } from "@/lib/policies/queries";
import { formatCurrency } from "@/lib/utils/format";

const INSURANCE_TYPE_LABEL: Record<string, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function isSoonOrOverdue(iso: string) {
  const diffDays = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return diffDays <= 30;
}

export function PolicyCardView({ card, onOpen }: { card: PolicyListItem; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.pipelineItemId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2.5 rounded-lg border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-xs)] transition-all duration-200 hover:shadow-[var(--elevation-sm)] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <button type="button" onClick={onOpen} {...attributes} {...listeners} className="flex flex-1 cursor-grab items-start gap-2.5 text-left active:cursor-grabbing">
        <Avatar name={card.contactName} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-snug text-foreground">{card.contactName}</p>
          <p className="truncate text-xs text-neutral-500">
            {card.company}
            {card.product ? ` · ${card.product}` : ""}
          </p>
        </div>
        {card.policyNumber && <FileText className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />}
      </button>

      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-foreground">{card.premium !== null ? formatCurrency(card.premium, card.premiumCurrency) : "—"}</p>
        <Badge variant="accent">{INSURANCE_TYPE_LABEL[card.insuranceType] ?? card.insuranceType}</Badge>
      </div>

      {card.endDate && (
        <div className={`flex items-center gap-1.5 text-xs ${isSoonOrOverdue(card.endDate) ? "text-warning-strong" : "text-neutral-500"}`}>
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Vence {formatDate(card.endDate)}</span>
        </div>
      )}

      {card.ownerName && <p className="truncate text-xs text-neutral-400">{card.ownerName}</p>}
    </div>
  );
}
