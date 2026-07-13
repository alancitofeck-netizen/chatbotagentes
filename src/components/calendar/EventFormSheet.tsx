"use client";

import { useState, useTransition } from "react";
import { CalendarClock, MapPin, Users, Bell, StickyNote, Building2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { ContactPicker, type PickedContact } from "@/app/(protected)/calendar/ContactPicker";
import { createEvent, updateEvent, deleteEvent, cancelEvent, type EventInput } from "@/lib/calendar/actions";
import type { CalendarEvent, EventRelatedType, EventType } from "@/lib/calendar/queries";
import type { TaskOption } from "@/lib/tasks/queries";
import { EVENT_TYPE_META, EVENT_TYPE_OPTIONS, REMINDER_OPTIONS } from "./eventTypeMeta";
import { cn } from "@/lib/utils/cn";

interface MemberOption {
  memberId: string;
  fullName: string;
}

type RelateTo = "" | "contact" | EventRelatedType;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function splitDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combine(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Argentina/Buenos_Aires";
  }
}

function SectionHeading({ icon: Icon, children }: { icon: typeof CalendarClock; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
      <Icon size={13} aria-hidden="true" />
      {children}
    </h3>
  );
}

/** Single form for create and edit, same convention as TaskFormSheet —
 * conditionally mounted by the parent, state seeded directly from `current`.
 * "Descripción"/"Notas internas" from the original spec share one column
 * (bookings.description) — no separate notes field was added for that, it's
 * the same free-text box. "Empresa" isn't a selectable relation type (no
 * companies table — same reasoning as Tasks); it's shown read-only once a
 * contact is picked, riding along automatically via contacts.company. */
export function EventFormSheet({
  current,
  defaultStart,
  members,
  conversationOptions,
  opportunityOptions,
  canAssignOthers,
  ownMemberId,
  onClose,
  onSaved,
  onDeleted,
}: {
  current: CalendarEvent | null;
  defaultStart?: Date;
  members: MemberOption[];
  conversationOptions: TaskOption[];
  opportunityOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const isEdit = Boolean(current);
  const start = current ? new Date(current.startTime) : (defaultStart ?? new Date());
  const end = current ? new Date(current.endTime) : new Date(start.getTime() + 30 * 60000);
  const startSplit = splitDateTime(start.toISOString());
  const endSplit = splitDateTime(end.toISOString());

  const [title, setTitle] = useState(current?.title ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [eventType, setEventType] = useState<EventType>(current?.eventType ?? "meeting");
  const [date, setDate] = useState(startSplit.date);
  const [startTime, setStartTime] = useState(startSplit.time);
  const [endTime, setEndTime] = useState(endSplit.time);
  const [timezone] = useState(current?.timezone ?? defaultTimezone());
  const [location, setLocation] = useState(current?.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(current?.meetingUrl ?? "");
  const [reminderMinutes, setReminderMinutes] = useState(current?.reminderMinutes != null ? String(current.reminderMinutes) : "");
  const [assignedTo, setAssignedTo] = useState(current?.assignedTo?.memberId ?? ownMemberId ?? "");
  const [relateTo, setRelateTo] = useState<RelateTo>(current?.contactId ? "contact" : (current?.relatedType ?? ""));
  const [contact, setContact] = useState<PickedContact | null>(
    current?.contactId && current.contactName ? { id: current.contactId, name: current.contactName, company: current.contactCompany } : null,
  );
  const [relatedId, setRelatedId] = useState(current?.relatedId ?? "");
  const [recurrenceRule, setRecurrenceRule] = useState<EventInput["recurrenceRule"]>(null);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const relatedOptions = relateTo === "conversation" ? conversationOptions : relateTo === "opportunity" ? opportunityOptions : [];
  const meta = EVENT_TYPE_META[eventType] ?? EVENT_TYPE_META.other;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: EventInput = {
      title,
      description,
      eventType,
      startTime: combine(date, startTime),
      endTime: combine(date, endTime),
      timezone,
      location,
      meetingUrl,
      reminderMinutes: reminderMinutes ? Number(reminderMinutes) : null,
      assignedTo,
      contactId: relateTo === "contact" ? (contact?.id ?? null) : null,
      relatedType: relateTo === "conversation" || relateTo === "opportunity" ? relateTo : null,
      relatedId: relateTo === "conversation" || relateTo === "opportunity" ? relatedId || null : null,
      recurrenceRule: isEdit ? null : recurrenceRule,
      recurrenceEndDate: isEdit ? null : recurrenceEndDate || null,
    };

    startTransition(async () => {
      try {
        if (isEdit && current) {
          await updateEvent(current.id, input);
        } else {
          await createEvent(input);
        }
        toast.success(isEdit ? "Evento actualizado." : "Evento creado.");
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el evento.");
      }
    });
  }

  function handleCancel() {
    if (!current) return;
    startTransition(async () => {
      await cancelEvent(current.id);
      toast.success("Evento cancelado.");
      onSaved();
    });
  }

  function handleDelete() {
    if (!current) return;
    if (!window.confirm(`¿Eliminar "${current.title}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await deleteEvent(current.id);
      toast.success("Evento eliminado.");
      onDeleted?.();
    });
  }

  return (
    <Sheet open onClose={onClose} title={isEdit ? "Editar evento" : "Nuevo evento"} className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-7 p-6">
        <div className="flex flex-col gap-4">
          <Input label="Título del evento" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus className="text-[15px]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Tipo de evento" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <div className="flex items-end pb-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", meta.bg, meta.text)}>
                <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden="true" />
                {meta.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
          <SectionHeading icon={CalendarClock}>Fecha y hora</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label="Hora inicio" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            <Input label="Hora fin" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </div>
          <p className="text-[12px] text-neutral-400">Zona horaria: {timezone}</p>

          {!isEdit && (
            <div className="grid grid-cols-1 gap-3 border-t border-border-default pt-3 sm:grid-cols-2">
              <Select
                label="Repetir"
                value={recurrenceRule ?? ""}
                onChange={(e) => setRecurrenceRule((e.target.value || null) as EventInput["recurrenceRule"])}
              >
                <option value="">No se repite</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </Select>
              {recurrenceRule && (
                <Input
                  label="Hasta"
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  hint="Máx. 52 repeticiones"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeading icon={Users}>Asignación y relación</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {canAssignOthers ? (
              <Select label="Asignar a" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.memberId === ownMemberId ? `${m.fullName} (vos)` : m.fullName}
                  </option>
                ))}
              </Select>
            ) : (
              <Input label="Asignar a" value="Vos" disabled hint="Tu rol solo permite asignarte eventos a vos mismo." />
            )}

            <Select
              label="Relacionar con"
              value={relateTo}
              onChange={(e) => {
                setRelateTo(e.target.value as RelateTo);
                setRelatedId("");
                setContact(null);
              }}
            >
              <option value="">Sin relación</option>
              <option value="contact">Contacto</option>
              <option value="conversation">Conversación de WhatsApp</option>
              <option value="opportunity">Oportunidad / lead</option>
            </Select>
          </div>

          {relateTo === "contact" && (
            <div className="flex flex-col gap-2">
              <ContactPicker selected={contact} onSelect={setContact} />
              {contact?.company && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
                  <Building2 size={13} aria-hidden="true" />
                  Empresa: {contact.company}
                </p>
              )}
            </div>
          )}
          {(relateTo === "conversation" || relateTo === "opportunity") && (
            <Select
              label={relateTo === "conversation" ? "Conversación" : "Oportunidad"}
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
            >
              <option value="">Elegir…</option>
              {relatedOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <SectionHeading icon={MapPin}>Ubicación y notas</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Link de reunión"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/…"
            />
            <Input label="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground" htmlFor="event-description">
              <StickyNote size={13} aria-hidden="true" />
              Descripción / notas internas
            </label>
            <textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeading icon={Bell}>Recordatorio</SectionHeading>
          <Select label="Notificarme" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)}>
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-border-default pt-5">
          {isEdit && current?.status !== "cancelled" && (
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isPending}>
              Cancelar evento
            </Button>
          )}
          {isEdit && (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
              Eliminar
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cerrar
          </Button>
          <Button type="submit" size="lg" loading={isPending}>
            {isEdit ? "Guardar cambios" : "Crear evento"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
