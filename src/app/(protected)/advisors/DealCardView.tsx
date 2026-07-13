"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Mail, Phone, MessageCircle, Eye, Pencil, StickyNote, ShieldCheck, CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { DealCard } from "@/lib/advisors/queries";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/format";

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function isSoonRenewal(iso: string) {
  const diffDays = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return diffDays >= 0 && diffDays <= 30;
}

export function DealCardView({
  card,
  onOpen,
  onEdit,
  onNote,
}: {
  card: DealCard;
  onOpen: () => void;
  onEdit: () => void;
  onNote: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.pipelineItemId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2.5 rounded-lg border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-xs)] transition-all duration-200 hover:shadow-[var(--elevation-sm)] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <button type="button" onClick={onOpen} {...attributes} {...listeners} className="flex flex-1 cursor-grab items-start gap-2.5 text-left active:cursor-grabbing">
        <Avatar name={card.contactName} src={card.contactAvatarUrl} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-snug text-foreground">{card.contactName}</p>
          {card.company && <p className="truncate text-xs text-neutral-500">{card.company}</p>}
        </div>
      </button>

      <p className="truncate text-[13px] text-foreground">{card.title}</p>

      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(card.value, card.currency)}</p>
        {card.policyType && (
          <Badge variant="accent">
            <ShieldCheck className="size-3" aria-hidden="true" />
            {card.policyType}
          </Badge>
        )}
      </div>

      {(card.commission !== null || card.renewalDate) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          {card.commission !== null && <span>Comisión: {formatCurrency(card.commission, card.currency)}</span>}
          {card.renewalDate && (
            <span className={`flex items-center gap-1 ${isSoonRenewal(card.renewalDate) ? "font-medium text-warning-strong" : ""}`}>
              <CalendarClock className="size-3" aria-hidden="true" />
              Renueva: {formatDate(card.renewalDate)}
            </span>
          )}
        </div>
      )}

      {(card.email || card.phone) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          {card.email && (
            <a href={`mailto:${card.email}`} className="flex items-center gap-1 hover:text-accent-700" onClick={(e) => e.stopPropagation()}>
              <Mail className="size-3" aria-hidden="true" />
              <span className="truncate">{card.email}</span>
            </a>
          )}
          {card.phone && (
            <a href={`tel:${card.phone}`} className="flex items-center gap-1 hover:text-accent-700" onClick={(e) => e.stopPropagation()}>
              <Phone className="size-3" aria-hidden="true" />
              {card.phone}
            </a>
          )}
        </div>
      )}

      {card.lastNote && <p className="truncate text-[11px] text-neutral-500">Última nota: {formatRelativeTime(card.lastNote.createdAt)}</p>}

      <div className="flex items-center justify-between border-t border-border-default pt-2">
        <Avatar name={card.ownerName ?? "Sin asignar"} size={20} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpen} className="text-neutral-400 hover:text-accent-700" title="Ver">
            <Eye className="size-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onEdit} className="text-neutral-400 hover:text-accent-700" title="Editar">
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
          {card.phone && (
            <>
              <a href={`tel:${card.phone}`} onClick={(e) => e.stopPropagation()} className="text-neutral-400 hover:text-accent-700" title="Llamar">
                <Phone className="size-3.5" aria-hidden="true" />
              </a>
              <a
                href={waLink(card.phone)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-400 hover:text-accent-700"
                title="WhatsApp"
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
              </a>
            </>
          )}
          <button type="button" onClick={onNote} className="text-neutral-400 hover:text-accent-700" title="Nota">
            <StickyNote className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
