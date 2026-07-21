"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import type { ContactDetail } from "@/lib/contacts/queries";
import type { WorkspaceTag } from "@/lib/inbox/queries";
import type { CalendarEvent } from "@/lib/calendar/queries";
import { addContactNote, updateContact } from "@/lib/contacts/actions";
import { toggleContactTag } from "@/lib/inbox/actions";
import { getContactEventsAction } from "@/lib/calendar/actions";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}
function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

const OPT_STATUS_OPTIONS = [
  { value: "unknown", label: "Desconocido" },
  { value: "subscribed", label: "Suscrito" },
  { value: "unsubscribed", label: "No suscrito" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Rendered with key={selectedId ?? "closed"} by ContactsShell so editable
 * field state resets per contact, same remount pattern as ConversationThread. */
export function ContactDetailPanel({
  detail,
  loading,
  tags,
  onChanged,
}: {
  detail: ContactDetail | null;
  loading: boolean;
  tags: WorkspaceTag[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState("resumen");
  const [name, setName] = useState(detail?.name ?? "");
  const [phone, setPhone] = useState(detail?.phone ?? "");
  const [email, setEmail] = useState(detail?.email ?? "");
  const [company, setCompany] = useState(detail?.company ?? "");
  const [source, setSource] = useState(detail?.source ?? "");
  const [optStatus, setOptStatus] = useState(detail?.whatsappOptStatus ?? "unknown");
  const [noteBody, setNoteBody] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (tab !== "reuniones" || eventsLoaded || !detail) return;
    getContactEventsAction(detail.id).then((fresh) => {
      setEvents(fresh);
      setEventsLoaded(true);
    });
  }, [tab, eventsLoaded, detail]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!detail) {
    return <div className="p-5 text-sm text-neutral-500">Seleccioná un contacto para ver sus detalles.</div>;
  }

  function handleSave() {
    if (!detail) return;
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        await updateContact(detail.id, {
          name,
          phone,
          email,
          company,
          source,
          whatsappOptStatus: optStatus as "subscribed" | "unsubscribed" | "unknown",
        });
        onChanged();
        toast.success("Contacto actualizado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el contacto.");
      }
    });
  }

  function handleAddNote() {
    if (!detail || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addContactNote(detail.id, body);
      onChanged();
      toast.success("Nota agregada.");
    });
  }

  function handleToggleTag(tagId: string, enabled: boolean) {
    if (!detail) return;
    startTransition(async () => {
      await toggleContactTag(detail.id, tagId, enabled);
      onChanged();
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-5 pt-4 pb-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="reuniones">Reuniones</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <div className="py-4">
            <TabsContent value="resumen">
              <div className="flex flex-col gap-4">
                <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
                <Input label="Origen" value={source} onChange={(e) => setSource(e.target.value)} />
                <Select label="Estado de WhatsApp" value={optStatus} onChange={(e) => setOptStatus(e.target.value)}>
                  {OPT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Button onClick={handleSave} loading={isPending}>
                  Guardar cambios
                </Button>

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Etiquetas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.length === 0 && (
                      <p className="text-xs text-neutral-500">No hay etiquetas en este workspace.</p>
                    )}
                    {tags.map((t) => {
                      const active = detail.tags.some((dt) => dt.id === t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleToggleTag(t.id, !active)}
                          className="disabled:opacity-50"
                        >
                          <Badge
                            variant={active ? tagBadgeVariant(t.color) : "neutral"}
                            className={active ? "" : "opacity-60"}
                          >
                            {t.name}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notas">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    placeholder="Agregar una nota…"
                    className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                  />
                  <Button size="sm" onClick={handleAddNote} loading={isPending}>
                    Agregar
                  </Button>
                </div>
                {detail.notes.length === 0 ? (
                  <p className="text-sm text-neutral-500">Sin notas todavía.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {detail.notes.map((note) => (
                      <li key={note.id} className="rounded-md bg-surface-2 p-3">
                        <p className="text-sm text-foreground">{note.body}</p>
                        <p className="mt-1 text-xs text-neutral-500">{formatDate(note.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reuniones">
              {!eventsLoaded ? (
                <Skeleton className="h-16 w-full" />
              ) : events.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin reuniones todavía.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {events.map((event) => {
                    const isPast = new Date(event.endTime) < new Date();
                    return (
                      <li key={event.id} className="rounded-md bg-surface-2 p-3">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <CalendarDays size={14} aria-hidden="true" />
                          {isPast ? "Reunión agendada" : "Próxima reunión"}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{event.title}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Fecha: {formatEventDate(event.startTime)} · Hora: {formatEventTime(event.startTime)}
                          {event.assignedTo && ` · Responsable: ${event.assignedTo.fullName}`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="historial">
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">Conversaciones</dt>
                  <dd className="text-foreground">{detail.activity.conversationsCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">Oportunidades</dt>
                  <dd className="text-foreground">{detail.activity.opportunitiesCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">Perfil de candidato</dt>
                  <dd className="text-foreground">{detail.activity.hasCandidateProfile ? "Sí" : "No"}</dd>
                </div>
                {detail.activity.lastConversationAt && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-neutral-500">Última conversación</dt>
                    <dd className="text-foreground">{formatDate(detail.activity.lastConversationAt)}</dd>
                  </div>
                )}
              </dl>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
