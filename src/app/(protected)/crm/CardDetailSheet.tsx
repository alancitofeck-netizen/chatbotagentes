"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { CalendarDays, CheckCircle2, Circle, Download, Trash2, Upload } from "lucide-react";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import { createClient } from "@/lib/supabase/client";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import type { OpportunityDetail, OpportunityActivityEntry } from "@/lib/crm/queries";
import type { CalendarEvent } from "@/lib/calendar/queries";
import type { TaskItem } from "@/lib/tasks/queries";
import type { DocumentItem } from "@/lib/documents/queries";
import { getOpportunityDetailAction, addOpportunityNote, getOpportunityActivityAction } from "@/lib/crm/actions";
import { getContactEventsAction } from "@/lib/calendar/actions";
import { getOpportunityTasksAction } from "@/lib/tasks/actions";
import { createTask, completeTask } from "@/lib/tasks/actions";
import { getDocumentsByRelatedAction, recordUploadedDocument, trashDocument, getDownloadUrl } from "@/lib/documents/actions";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDateOnly(iso: string) {
  // Split on "-" instead of `new Date(iso)` — a bare "YYYY-MM-DD" parses as
  // UTC midnight, which can roll back a day in negative-UTC-offset zones
  // (same date-parsing gotcha documented in the Calendar module).
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}
function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

const PRIORITY_LABEL: Record<"high" | "medium" | "low", string> = { high: "Alta", medium: "Media", low: "Baja" };
const COMING_SOON_TABS = ["conversaciones", "emails", "whatsapp", "ia"];

export function CardDetailSheet({
  opportunityId,
  initialTab = "resumen",
  onClose,
  onEdit,
}: {
  opportunityId: string | null;
  initialTab?: "resumen" | "notas" | "reuniones" | "historial";
  onClose: () => void;
  onEdit: () => void;
}) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [tab, setTab] = useState<"resumen" | "notas" | "tareas" | "archivos" | "reuniones" | "historial">(initialTab);
  const [noteBody, setNoteBody] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activity, setActivity] = useState<OpportunityActivityEntry[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The caller (CrmBoardShell) remounts this component via a `key` tied to
  // opportunityId, so `detail`/`tab` already start fresh from their initial
  // state on every open — no need to reset them synchronously here too.
  useEffect(() => {
    if (!opportunityId) return;
    getOpportunityDetailAction(opportunityId).then(setDetail);
  }, [opportunityId]);

  useEffect(() => {
    if (tab !== "reuniones" || eventsLoaded || !detail) return;
    getContactEventsAction(detail.contact.id).then((fresh) => {
      setEvents(fresh);
      setEventsLoaded(true);
    });
  }, [tab, eventsLoaded, detail]);

  useEffect(() => {
    if (tab !== "tareas" || tasksLoaded || !opportunityId) return;
    getOpportunityTasksAction(opportunityId).then((fresh) => {
      setTasks(fresh);
      setTasksLoaded(true);
    });
  }, [tab, tasksLoaded, opportunityId]);

  useEffect(() => {
    if (tab !== "archivos" || documentsLoaded || !opportunityId) return;
    getDocumentsByRelatedAction("opportunity", opportunityId).then((fresh) => {
      setDocuments(fresh);
      setDocumentsLoaded(true);
    });
  }, [tab, documentsLoaded, opportunityId]);

  useEffect(() => {
    if (tab !== "historial" || activityLoaded || !opportunityId) return;
    getOpportunityActivityAction(opportunityId).then((fresh) => {
      setActivity(fresh);
      setActivityLoaded(true);
    });
  }, [tab, activityLoaded, opportunityId]);

  function handleAddNote() {
    if (!opportunityId || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addOpportunityNote(opportunityId, body);
      const fresh = await getOpportunityDetailAction(opportunityId);
      setDetail(fresh);
      toast.success("Nota agregada.");
    });
  }

  function handleAddTask() {
    if (!opportunityId || !newTaskTitle.trim()) return;
    const title = newTaskTitle.trim();
    const dueAt = newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null;
    setNewTaskTitle("");
    setNewTaskDueDate("");
    startTransition(async () => {
      try {
        await createTask({
          title,
          description: "",
          priority: "medium",
          dueAt,
          assignedTo: "",
          relatedType: "opportunity",
          relatedId: opportunityId,
        });
        const fresh = await getOpportunityTasksAction(opportunityId);
        setTasks(fresh);
        toast.success("Tarea creada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea.");
      }
    });
  }

  function handleCompleteTask(taskId: string) {
    if (!opportunityId) return;
    startTransition(async () => {
      await completeTask(taskId);
      const fresh = await getOpportunityTasksAction(opportunityId);
      setTasks(fresh);
    });
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !opportunityId || !detail) return;
    setUploading(true);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const documentId = crypto.randomUUID();
      const storagePath = `${detail.workspaceId}/${documentId}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file);
      if (uploadError) {
        toast.error(`No se pudo subir ${file.name}.`);
        continue;
      }
      try {
        await recordUploadedDocument({
          name: file.name,
          folderId: null,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          storagePath,
          relatedType: "opportunity",
          relatedId: opportunityId,
        });
      } catch {
        toast.error(`No se pudo registrar ${file.name}.`);
      }
    }
    const fresh = await getDocumentsByRelatedAction("opportunity", opportunityId);
    setDocuments(fresh);
    setUploading(false);
    toast.success("Archivo(s) subido(s).");
  }

  function handleDownload(documentId: string) {
    startTransition(async () => {
      const url = await getDownloadUrl(documentId);
      if (url) window.open(url, "_blank");
    });
  }

  function handleDeleteDocument(documentId: string) {
    if (!opportunityId) return;
    if (!window.confirm("¿Eliminar este archivo?")) return;
    startTransition(async () => {
      await trashDocument(documentId);
      const fresh = await getDocumentsByRelatedAction("opportunity", opportunityId);
      setDocuments(fresh);
    });
  }

  return (
    <Sheet open={opportunityId !== null} onClose={onClose} title={detail?.title ?? "Oportunidad"}>
      {!detail ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="px-5 pt-4">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "resumen" | "notas" | "tareas" | "archivos" | "reuniones" | "historial")}
            >
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="notas">Notas</TabsTrigger>
                <TabsTrigger value="tareas">Tareas</TabsTrigger>
                <TabsTrigger value="archivos">Archivos</TabsTrigger>
                <TabsTrigger value="reuniones">Reuniones</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
                {COMING_SOON_TABS.map((t) => (
                  <TabsTrigger key={t} value={t} disabled>
                    {t === "ia" ? "IA" : t[0].toUpperCase() + t.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="py-4">
                <TabsContent value="resumen">
                  <dl className="flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Valor</dt>
                      <dd className="font-mono font-semibold text-foreground">
                        {formatCurrency(detail.value, detail.currency)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Estado</dt>
                      <dd>
                        <Badge variant={detail.status === "won" ? "success" : "neutral"}>{detail.status}</Badge>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Prioridad</dt>
                      <dd className="text-foreground">{PRIORITY_LABEL[detail.priority]}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Probabilidad de cierre</dt>
                      <dd className="text-foreground">{detail.probability !== null ? `${detail.probability}%` : "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Fecha de cierre estimada</dt>
                      <dd className="flex items-center gap-2 text-foreground">
                        {detail.expectedCloseDate ? formatDateOnly(detail.expectedCloseDate) : "—"}
                        {detail.expectedCloseDate && (
                          <Link
                            href={`/calendar?view=day&date=${detail.expectedCloseDate}${detail.calendarEventId ? `&event=${detail.calendarEventId}` : ""}`}
                            className="text-[12px] text-accent-600 hover:underline"
                          >
                            Ver en calendario
                          </Link>
                        )}
                      </dd>
                    </div>
                    {detail.tags.length > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <dt className="shrink-0 text-neutral-500">Etiquetas</dt>
                        <dd className="flex flex-wrap justify-end gap-1">
                          {detail.tags.map((tag) => (
                            <Badge key={tag.id} variant={tagBadgeVariant(tag.color)}>
                              {tag.name}
                            </Badge>
                          ))}
                        </dd>
                      </div>
                    )}
                    <div className="my-1 h-px bg-border-default" />
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Contacto</dt>
                      <dd className="text-foreground">{detail.contact.name}</dd>
                    </div>
                    {detail.contact.company && (
                      <div className="flex items-center justify-between">
                        <dt className="text-neutral-500">Empresa</dt>
                        <dd className="text-foreground">{detail.contact.company}</dd>
                      </div>
                    )}
                    {detail.contact.email && (
                      <div className="flex items-center justify-between">
                        <dt className="text-neutral-500">Email</dt>
                        <dd className="truncate text-foreground">{detail.contact.email}</dd>
                      </div>
                    )}
                    {detail.contact.phone && (
                      <div className="flex items-center justify-between">
                        <dt className="text-neutral-500">Teléfono</dt>
                        <dd className="text-foreground">{detail.contact.phone}</dd>
                      </div>
                    )}
                  </dl>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={onEdit}>
                    Editar
                  </Button>
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

                <TabsContent value="tareas">
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Nueva tarea…"
                        className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                      />
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="rounded-sm border border-border-strong bg-surface-1 px-2 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                      />
                      <Button size="sm" onClick={handleAddTask} loading={isPending}>
                        Agregar
                      </Button>
                    </div>
                    {!tasksLoaded ? (
                      <Skeleton className="h-16 w-full" />
                    ) : tasks.length === 0 ? (
                      <p className="text-sm text-neutral-500">Sin tareas todavía.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {tasks.map((task) => (
                          <li key={task.id} className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
                            <button
                              type="button"
                              onClick={() => task.status !== "completed" && handleCompleteTask(task.id)}
                              className="shrink-0 text-neutral-400 hover:text-success-strong"
                              aria-label="Marcar completada"
                            >
                              {task.status === "completed" ? (
                                <CheckCircle2 size={17} className="text-success-strong" aria-hidden="true" />
                              ) : (
                                <Circle size={17} aria-hidden="true" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-sm ${task.status === "completed" ? "text-neutral-400 line-through" : "text-foreground"}`}>
                                {task.title}
                              </p>
                              {task.dueAt && <p className="text-xs text-neutral-500">Vence: {formatEventDate(task.dueAt)}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="archivos">
                  <div className="flex flex-col gap-3">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-3 text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
                      <Upload size={15} aria-hidden="true" />
                      {uploading ? "Subiendo…" : "Subir archivo"}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handleUploadFiles(e.target.files)}
                      />
                    </label>
                    {!documentsLoaded ? (
                      <Skeleton className="h-16 w-full" />
                    ) : documents.length === 0 ? (
                      <p className="text-sm text-neutral-500">Sin archivos todavía.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {documents.map((doc) => {
                          const meta = fileTypeMetaFor(doc.name);
                          const Icon = meta.icon;
                          return (
                            <li key={doc.id} className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
                              <Icon size={16} className={meta.color} aria-hidden="true" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-foreground">{doc.name}</p>
                                <p className="text-xs text-neutral-500">{formatFileSize(doc.sizeBytes)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDownload(doc.id)}
                                className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                                aria-label="Descargar"
                              >
                                <Download size={14} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                                aria-label="Eliminar"
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </li>
                          );
                        })}
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
                  {!activityLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {/* Fallback for opportunities created before this feature shipped — no
                         audit_log row exists for their creation, so `createdAt` is the only signal. */}
                      {!activity.some((a) => a.action === "Oportunidad creada") && (
                        <li className="rounded-md bg-surface-2 p-3">
                          <p className="text-sm font-medium text-foreground">Oportunidad creada</p>
                          <p className="mt-1 text-xs text-neutral-500">{formatDate(detail.createdAt)}</p>
                        </li>
                      )}
                      {activity.map((a) => (
                        <li key={a.id} className="rounded-md bg-surface-2 p-3">
                          <p className="text-sm font-medium text-foreground">
                            {a.action}
                            {a.metadata.from_stage && a.metadata.to_stage
                              ? `: ${a.metadata.from_stage} → ${a.metadata.to_stage}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {formatDate(a.createdAt)}
                            {a.actorName && ` · ${a.actorName}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {COMING_SOON_TABS.map((t) => (
                  <TabsContent key={t} value={t}>
                    <p className="text-sm text-neutral-500">Disponible cuando se active el módulo de Inbox.</p>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
        </div>
      )}
    </Sheet>
  );
}
