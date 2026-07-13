"use client";

import { useTransition } from "react";
import { CalendarClock, MapPin, Link as LinkIcon, User, Building2, StickyNote, Bell, Repeat, Video } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { cancelEvent, deleteEvent } from "@/lib/calendar/actions";
import type { CalendarEvent } from "@/lib/calendar/queries";
import { EVENT_TYPE_META, REMINDER_OPTIONS } from "./eventTypeMeta";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatTimeRange(startIso: string, endIso: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${new Date(startIso).toLocaleTimeString("es", opts)} – ${new Date(endIso).toLocaleTimeString("es", opts)}`;
}

const RECURRENCE_LABEL: Record<string, string> = { daily: "Se repite a diario", weekly: "Se repite semanalmente", monthly: "Se repite mensualmente" };

function Row({ icon: Icon, children }: { icon: typeof CalendarClock; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-neutral-500">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Read-only detail view opened on click — separate from EventFormSheet
 * (edit form), same "detail drawer with an Editar button that swaps to the
 * edit sheet" pattern as CRM's CardDetailSheet. */
export function EventDetailDrawer({
  event,
  onClose,
  onEdit,
  onChanged,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const meta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other;
  const isCancelled = event.status === "cancelled";
  const reminderLabel = REMINDER_OPTIONS.find((o) => o.value === (event.reminderMinutes != null ? String(event.reminderMinutes) : ""))?.label;

  function handleCancel() {
    startTransition(async () => {
      await cancelEvent(event.id);
      toast.success("Evento cancelado.");
      onChanged();
      onClose();
    });
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar "${event.title}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await deleteEvent(event.id);
      toast.success("Evento eliminado.");
      onChanged();
      onClose();
    });
  }

  return (
    <Sheet open onClose={onClose} title={event.title} className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.bg, meta.text)}>{meta.label}</span>
          {isCancelled && <Badge variant="error">Cancelado</Badge>}
          {event.provider === "google" && <Badge variant="accent">Google Calendar</Badge>}
        </div>

        <Row icon={CalendarClock}>
          <p className={cn("font-medium capitalize", isCancelled && "text-neutral-400 line-through")}>{formatDate(event.startTime)}</p>
          <p className="text-neutral-500">
            {formatTimeRange(event.startTime, event.endTime)}
            {event.timezone && ` · ${event.timezone}`}
          </p>
          {event.recurrenceRule && <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400"><Repeat size={12} aria-hidden="true" />{RECURRENCE_LABEL[event.recurrenceRule]}</p>}
        </Row>

        {event.location && (
          <Row icon={MapPin}>
            <p>{event.location}</p>
          </Row>
        )}

        {event.meetingUrl && (
          <Row icon={Video}>
            <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="break-all text-accent-600 hover:underline">
              {event.meetingUrl}
            </a>
          </Row>
        )}

        {event.assignedTo && (
          <Row icon={User}>
            <div className="flex items-center gap-2">
              <Avatar name={event.assignedTo.fullName} size={24} />
              <span>{event.assignedTo.fullName}</span>
            </div>
            <p className="text-xs text-neutral-400">Responsable</p>
          </Row>
        )}

        {event.contactName && (
          <Row icon={Building2}>
            <div className="flex items-center gap-2">
              <Avatar name={event.contactName} size={24} />
              <span>{event.contactName}</span>
            </div>
            {event.contactCompany && <p className="text-xs text-neutral-400">{event.contactCompany}</p>}
          </Row>
        )}

        {event.relatedLabel && (
          <Row icon={LinkIcon}>
            <p>{event.relatedLabel}</p>
          </Row>
        )}

        {event.description && (
          <Row icon={StickyNote}>
            <p className="whitespace-pre-wrap text-neutral-600">{event.description}</p>
          </Row>
        )}

        <Row icon={Bell}>
          <p className={reminderLabel && reminderLabel !== "Sin recordatorio" ? "" : "text-neutral-400"}>{reminderLabel ?? "Sin recordatorio"}</p>
        </Row>

        <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-border-default pt-4">
          {!isCancelled && (
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isPending}>
              Cancelar evento
            </Button>
          )}
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            Eliminar
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cerrar
          </Button>
          <Button type="button" onClick={onEdit} disabled={isPending}>
            Editar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
