"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  MapPin,
  Link as LinkIcon,
  User,
  Building2,
  StickyNote,
  Bell,
  Repeat,
  Video,
  Kanban,
  ListTodo,
  MessageCircle,
  Copy,
  CalendarRange,
} from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { cancelEvent, deleteEvent, createEvent, getEventCrmSummaryAction } from "@/lib/calendar/actions";
import { createTask } from "@/lib/tasks/actions";
import type { CalendarEvent } from "@/lib/calendar/queries";
import type { ContactCrmSummary } from "@/lib/inbox/queries";
import { EVENT_TYPE_META, REMINDER_OPTIONS } from "./eventTypeMeta";
import { CAL_PRIMARY, calSecondaryButton, meetingChannel } from "./calendarColors";

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
 * edit sheet" pattern as CRM's CardDetailSheet. Extended with a CRM section
 * (reusa getEventCrmSummaryAction, la misma query que ya arma esto para el
 * panel del Inbox) y accesos directos (tarea/nota/WhatsApp/CRM/contacto/
 * duplicar), a pedido explícito. */
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
  const channel = meetingChannel(event.meetingUrl);

  const [crm, setCrm] = useState<ContactCrmSummary | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (!event.contactId) {
      Promise.resolve().then(() => setCrm(null));
      return;
    }
    Promise.resolve().then(() => setCrmLoading(true));
    getEventCrmSummaryAction(event.contactId, event.relatedType === "conversation" ? event.relatedId : null).then((data) => {
      setCrm(data);
      setCrmLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, event.contactId]);

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

  /** Duplica a la semana siguiente, mismo día/hora — un default razonable
   * para el caso de uso más común (repetir una reunión puntual) sin
   * necesitar un segundo formulario; el usuario reprograma después con
   * drag & drop o "Editar" si el horario no le sirve. */
  function handleDuplicate() {
    setDuplicating(true);
    const shiftedStart = new Date(new Date(event.startTime).getTime() + 7 * 24 * 60 * 60000);
    const shiftedEnd = new Date(new Date(event.endTime).getTime() + 7 * 24 * 60 * 60000);
    createEvent({
      title: `${event.title} (copia)`,
      description: event.description ?? "",
      eventType: event.eventType,
      startTime: shiftedStart.toISOString(),
      endTime: shiftedEnd.toISOString(),
      timezone: event.timezone ?? "",
      location: event.location ?? "",
      meetingUrl: event.meetingUrl ?? "",
      reminderMinutes: event.reminderMinutes,
      assignedTo: event.assignedTo?.memberId ?? "",
      contactId: event.contactId,
      relatedType: event.relatedType,
      relatedId: event.relatedId,
      recurrenceRule: null,
      recurrenceEndDate: null,
    })
      .then(() => {
        toast.success("Evento duplicado a la semana siguiente.");
        onChanged();
        onClose();
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo duplicar el evento."))
      .finally(() => setDuplicating(false));
  }

  function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    createTask({
      title: newTaskTitle.trim(),
      description: "",
      priority: "medium",
      dueAt: null,
      assignedTo: "",
      relatedType: "opportunity",
      relatedId: crm?.opportunity?.opportunityId ?? event.id,
    })
      .then(() => {
        toast.success("Tarea creada.");
        setNewTaskTitle("");
        setShowTaskForm(false);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea."))
      .finally(() => setCreatingTask(false));
  }

  return (
    <Sheet open onClose={onClose} title={event.title} className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.bg, meta.text)}>{meta.label}</span>
          {isCancelled && <Badge variant="error">Cancelado</Badge>}
          {event.provider === "google" && (
            <span className={`rounded-full ${CAL_PRIMARY.tint} ${CAL_PRIMARY.tintText} px-2.5 py-1 text-xs font-semibold`}>Google Calendar</span>
          )}
          {channel && <span className={`rounded-full ${channel.tint} ${channel.text} px-2.5 py-1 text-xs font-semibold`}>{channel.label}</span>}
        </div>

        {/* Accesos directos — Crear tarea / Enviar WhatsApp / Abrir contacto /
            Abrir CRM / Duplicar / Reprogramar, a pedido explícito. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setShowTaskForm((v) => !v)} className={calSecondaryButton}>
            <ListTodo size={13} /> Crear tarea
          </button>
          {event.contactId && (
            <Link href="/inbox" className={calSecondaryButton}>
              <MessageCircle size={13} /> Enviar WhatsApp
            </Link>
          )}
          {event.contactId && (
            <Link href="/inbox/contactos" className={calSecondaryButton}>
              <User size={13} /> Abrir contacto
            </Link>
          )}
          {crm?.opportunity && (
            <Link href="/crm" className={calSecondaryButton}>
              <Kanban size={13} /> Abrir CRM
            </Link>
          )}
          {!isCancelled && (
            <button type="button" onClick={handleDuplicate} disabled={duplicating} className={calSecondaryButton}>
              <Copy size={13} /> Duplicar
            </button>
          )}
          {!isCancelled && (
            <button type="button" onClick={onEdit} className={calSecondaryButton}>
              <CalendarRange size={13} /> Reprogramar
            </button>
          )}
        </div>

        {showTaskForm && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
              placeholder="Título de la tarea…"
              className="flex-1 rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-[13px] outline-none focus:border-blue-500 focus:bg-surface-1"
            />
            <button
              type="button"
              disabled={creatingTask || !newTaskTitle.trim()}
              onClick={handleCreateTask}
              className={`${CAL_PRIMARY.bg} ${CAL_PRIMARY.bgHover} rounded-full px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40`}
            >
              Crear
            </button>
          </div>
        )}

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
            <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="break-all text-blue-600 hover:underline">
              {event.meetingUrl}
            </a>
          </Row>
        )}

        {event.assignedTo && (
          <Row icon={User}>
            <div className="flex items-center gap-2">
              <Avatar name={event.assignedTo.fullName} src={event.assignedTo.avatarUrl} size={24} />
              <span>{event.assignedTo.fullName}</span>
            </div>
            <p className="text-xs text-neutral-400">Responsable</p>
          </Row>
        )}

        {event.contactName && (
          <Row icon={Building2}>
            <div className="flex items-center gap-2">
              <Avatar name={event.contactName} src={event.contactAvatarUrl} size={24} />
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

        {/* CRM: pipeline / etapa / valor / responsable — solo si el evento
            está ligado a un contacto con una oportunidad activa. */}
        {event.contactId && (
          <section className="flex flex-col gap-2 border-t border-border-default pt-4">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              <Kanban size={12} /> CRM
            </h3>
            {crmLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : crm?.opportunity ? (
              <div className={`flex flex-col gap-1.5 rounded-lg ${CAL_PRIMARY.tint} p-3 text-sm`}>
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${CAL_PRIMARY.tintText}`}>{formatCurrency(crm.opportunity.value, crm.opportunity.currency)}</span>
                  <span className="text-xs text-neutral-500">{crm.opportunity.pipelineName}</span>
                </div>
                <p className="text-xs text-neutral-600">
                  Etapa: <span className="font-medium text-foreground">{crm.opportunity.stageName}</span>
                </p>
                {crm.opportunity.ownerName && <p className="text-xs text-neutral-500">Responsable: {crm.opportunity.ownerName}</p>}
              </div>
            ) : (
              <p className="text-[13px] text-neutral-500">Este contacto no tiene una oportunidad activa en el CRM.</p>
            )}
            {crm && crm.relatedTasks.length > 0 && (
              <ul className="flex flex-col gap-1">
                {crm.relatedTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-1.5 text-[12px] text-neutral-600">
                    <ListTodo size={11} className="shrink-0" /> {t.title}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

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
          <button type="button" onClick={onEdit} disabled={isPending} className={`${CAL_PRIMARY.bg} ${CAL_PRIMARY.bgHover} rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-40`}>
            Editar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
