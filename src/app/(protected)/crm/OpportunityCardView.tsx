"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Mail, Phone, MessageCircle, Eye, Pencil, StickyNote, CalendarClock, CalendarDays } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import type { OpportunityCard, PipelineStage } from "@/lib/crm/queries";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/format";

// Split on "-" instead of `new Date(iso)` — a bare "YYYY-MM-DD" parses as
// UTC midnight, which can roll back a day in negative-UTC-offset zones (same
// gotcha already documented/fixed in CardDetailSheet.tsx's formatDateOnly).
function formatCloseDate(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

const PRIORITY_LABEL: Record<OpportunityCard["priority"], string> = { high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_VARIANT: Record<OpportunityCard["priority"], "error" | "warning" | "neutral"> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.pipelineItemId,
  });

  const stageIndex = stages.findIndex((s) => s.id === card.stageId);
  const progressPct = stages.length > 1 ? Math.round((stageIndex / (stages.length - 1)) * 100) : 0;

  const badges: { key: string; label: string }[] = [];
  if (card.priority === "high") badges.push({ key: "hot", label: "🔥 Caliente" });
  if (card.daysSinceActivity !== null && card.daysSinceActivity >= 7) badges.push({ key: "stale", label: "⏳ Sin actividad" });
  if (card.nextMeeting && isToday(card.nextMeeting.startTime)) badges.push({ key: "meeting", label: "📅 Reunión hoy" });
  if (avgOpenValue > 0 && card.value >= avgOpenValue * 1.5) badges.push({ key: "high-value", label: "💰 Alto potencial" });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2.5 rounded-lg border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-xs)] transition-all duration-200 hover:shadow-[var(--elevation-sm)] ${
        isDragging ? "opacity-40" : ""
      } ${selected ? "ring-2 ring-accent-500" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          {...(selectionMode ? {} : { ...attributes, ...listeners })}
          className={`flex flex-1 items-start gap-2.5 text-left ${selectionMode ? "" : "cursor-grab active:cursor-grabbing"}`}
        >
          <Avatar name={card.contactName} src={card.contactAvatarUrl} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-snug text-foreground">{card.contactName}</p>
            {(card.company || card.jobTitle) && (
              <p className="truncate text-xs text-neutral-500">
                {card.jobTitle}
                {card.jobTitle && card.company && " · "}
                {card.company}
              </p>
            )}
          </div>
        </button>
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-1 size-4 shrink-0 rounded border-border-strong accent-[var(--color-accent-500)]"
          />
        )}
      </div>

      <p className="truncate text-[13px] text-foreground">{card.title}</p>

      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(card.value, card.currency)}</p>
        <Badge variant={PRIORITY_VARIANT[card.priority]}>{PRIORITY_LABEL[card.priority]}</Badge>
      </div>

      {card.probability !== null && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent-500" style={{ width: `${card.probability}%` }} />
          </div>
          <span className="text-[11px] text-neutral-500">{card.probability}%</span>
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

      {(card.lastContactAt || card.nextMeeting || card.expectedCloseDate || card.daysSinceActivity !== null) && (
        <div className="flex flex-col gap-0.5 text-[11px] text-neutral-500">
          {card.lastContactAt && <p>Último contacto: {formatRelativeTime(card.lastContactAt)}</p>}
          {card.nextMeeting && (
            <p className="flex items-center gap-1">
              <CalendarClock className="size-3" aria-hidden="true" />
              Próxima reunión: {formatRelativeTime(card.nextMeeting.startTime)}
            </p>
          )}
          {card.expectedCloseDate && (
            <Link
              href={`/calendar?view=day&date=${card.expectedCloseDate}${card.calendarEventId ? `&event=${card.calendarEventId}` : ""}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 hover:text-accent-700 hover:underline"
              title="Ver en calendario"
            >
              <CalendarDays className="size-3" aria-hidden="true" />
              Fecha cierre: {formatCloseDate(card.expectedCloseDate)}
            </Link>
          )}
          {card.daysSinceActivity !== null && card.daysSinceActivity > 0 && <p>{card.daysSinceActivity} días sin actividad</p>}
        </div>
      )}

      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <Badge key={tag.id} variant={tagBadgeVariant(tag.color)}>
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="h-1 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${stages[stageIndex]?.isLost ? "bg-error" : "bg-success"}`} style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Avatar name={card.ownerName ?? "Sin asignar"} size={20} />
        {badges.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1 text-[10px] text-neutral-500">
            {badges.map((b) => (
              <span key={b.key}>{b.label}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border-default pt-2">
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
        {card.email && (
          <a href={`mailto:${card.email}`} onClick={(e) => e.stopPropagation()} className="text-neutral-400 hover:text-accent-700" title="Email">
            <Mail className="size-3.5" aria-hidden="true" />
          </a>
        )}
        <button type="button" onClick={onNote} className="text-neutral-400 hover:text-accent-700" title="Nota">
          <StickyNote className="size-3.5" aria-hidden="true" />
        </button>
        {card.expectedCloseDate && (
          <Link
            href={`/calendar?view=day&date=${card.expectedCloseDate}${card.calendarEventId ? `&event=${card.calendarEventId}` : ""}`}
            onClick={(e) => e.stopPropagation()}
            className="text-neutral-400 hover:text-accent-700"
            title="Ver en calendario"
          >
            <CalendarDays className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
