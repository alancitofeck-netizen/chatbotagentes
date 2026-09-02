"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Download,
  Trash2,
  Upload,
  MessageCircle,
  Phone,
  Mail,
  ListTodo,
  MoreHorizontal,
  Plus,
  Pencil,
  ArrowRightLeft,
  Clock,
  ChevronRight,
} from "lucide-react";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import type { OpportunityDetail, OpportunityActivityEntry, OpportunityTag, PipelineStage } from "@/lib/crm/queries";
import type { CalendarEvent } from "@/lib/calendar/queries";
import type { TaskItem } from "@/lib/tasks/queries";
import type { DocumentItem } from "@/lib/documents/queries";
import type { ContactConversationSummary } from "@/lib/inbox/queries";
import { getOpportunityDetailAction, addOpportunityNote, getOpportunityActivityAction, moveOpportunityCard, deleteOpportunity } from "@/lib/crm/actions";
import { getContactEventsAction } from "@/lib/calendar/actions";
import { getOpportunityTasksAction } from "@/lib/tasks/actions";
import { createTask, completeTask } from "@/lib/tasks/actions";
import { getDocumentsByRelatedAction, recordUploadedDocument, trashDocument, getDownloadUrl } from "@/lib/documents/actions";
import { getContactConversationsSummaryAction, toggleContactTag } from "@/lib/inbox/actions";
import { CHANNEL_LABEL, CHANNEL_ICON, resolveChannel } from "@/lib/crm/channels";

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

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

function activityIcon(action: string) {
  if (action.includes("creada")) return Plus;
  if (action.includes("eliminada")) return Trash2;
  if (action.includes("Etapa") || action.includes("etapa")) return ArrowRightLeft;
  if (action.includes("actualizada")) return Pencil;
  return Clock;
}

const PRIORITY_LABEL: Record<"high" | "medium" | "low", string> = { high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_VARIANT: Record<"high" | "medium" | "low", "error" | "warning" | "neutral"> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

const CONVERSATION_STATUS_LABEL: Record<string, string> = { open: "Activa", pending_human: "Esperando respuesta", closed: "Cerrada" };

/** Labels de los campos opcionales por fuente que escribe el wizard de
 * "Nuevo lead" (LeadWizardSheet.tsx) en contacts.custom_fields.source_details
 * — se muestra el primer bloque que tenga datos reales, y dentro de él solo
 * los campos que realmente tengan valor (nunca campos vacíos). */
const SOURCE_DETAIL_LABELS: Record<string, Record<string, string>> = {
  instagram: { username: "Usuario", campaign: "Campaña", ad: "Anuncio", conversationId: "ID de conversación" },
  tiktok: { username: "Usuario", campaign: "Campaña", video: "Video / anuncio", leadId: "ID de lead" },
  web: { landingPage: "Landing Page", formulario: "Formulario", utmSource: "UTM Source", utmCampaign: "UTM Campaign" },
  miniApp: { miniAppName: "Mini App", formulario: "Formulario", submissionId: "ID de envío" },
  referido: { referredBy: "Referido por", relation: "Relación", notes: "Notas" },
};

function sourceDetailRows(sourceDetails: Record<string, unknown> | null): [string, string][] | null {
  if (!sourceDetails) return null;
  for (const [key, labels] of Object.entries(SOURCE_DETAIL_LABELS)) {
    const block = sourceDetails[key] as Record<string, string> | undefined;
    if (!block) continue;
    const rows = Object.entries(labels)
      .map(([field, label]): [string, string] => [label, block[field] ?? ""])
      .filter(([, value]) => value.trim());
    if (rows.length > 0) return rows;
  }
  return null;
}

type DrawerTab = "resumen" | "actividad" | "conversaciones" | "notas" | "tareas" | "archivos" | "reuniones";

/** Drawer lateral de detalle de un lead — "centro de control": header con
 * fuente/etapa/valor/prioridad, acciones rápidas, 7 tabs reales (Resumen/
 * Actividad/Conversaciones/Notas/Tareas/Archivos/Reuniones) y una barra de
 * acciones fija abajo (Editar/Mover etapa/Eliminar). */
export function CardDetailSheet({
  opportunityId,
  initialTab = "resumen",
  stages,
  tags,
  onClose,
  onEdit,
  onChanged,
}: {
  opportunityId: string | null;
  initialTab?: "resumen" | "notas" | "tareas" | "reuniones" | "actividad" | "conversaciones";
  stages: PipelineStage[];
  /** Etiquetas reales del workspace — para el picker "+ Agregar etiqueta"
   * de Resumen (mismo toggleContactTag que ya usa LeadWizardSheet.tsx). */
  tags: OpportunityTag[];
  onClose: () => void;
  onEdit: () => void;
  /** Se llama tras mover de etapa, (des)agregar etiqueta o eliminar, para
   * que CrmBoardShell refresque el board (mismo patrón que el resto de
   * mutaciones). */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [tab, setTab] = useState<DrawerTab>(initialTab);
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
  const [conversations, setConversations] = useState<ContactConversationSummary[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [movingStage, setMovingStage] = useState(false);
  const [togglingTagId, setTogglingTagId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The caller (CrmBoardShell) remounts this component via a `key` tied to
  // opportunityId, so `detail`/`tab` already start fresh from their initial
  // state on every open — no need to reset them synchronously here too.
  useEffect(() => {
    if (!opportunityId) return;
    getOpportunityDetailAction(opportunityId).then(setDetail);
  }, [opportunityId]);

  // Se dispara apenas carga `detail` (no solo al entrar a la tab
  // Conversaciones) porque Resumen también necesita esta misma data para
  // su sección "Canal actual" (la conversación más reciente) — mismo
  // query, un solo fetch, ambas tabs leen el mismo estado ya cargado.
  useEffect(() => {
    if (conversationsLoaded || !detail?.contact.id) return;
    getContactConversationsSummaryAction(detail.contact.id).then((fresh) => {
      setConversations(fresh);
      setConversationsLoaded(true);
    });
  }, [conversationsLoaded, detail]);

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
    if (tab !== "actividad" || activityLoaded || !opportunityId) return;
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
    for (const file of Array.from(files)) {
      const documentId = crypto.randomUUID();
      const storagePath = `${detail.workspaceId}/${documentId}/${file.name}`;
      const uploaded = await uploadDocumentFile(storagePath, file);
      if (!uploaded) {
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

  function handleMoveStage(stageId: string) {
    if (!detail?.pipelineItemId || !stageId) return;
    setMovingStage(true);
    moveOpportunityCard(detail.pipelineItemId, stageId, 0)
      .then(async () => {
        toast.success("Lead movido de etapa.");
        onChanged();
        if (opportunityId) setDetail(await getOpportunityDetailAction(opportunityId));
      })
      .catch(() => toast.error("No se pudo mover el lead."))
      .finally(() => setMovingStage(false));
  }

  function handleToggleTag(tagId: string, currentlyOn: boolean) {
    if (!detail?.contact.id || !opportunityId) return;
    setTogglingTagId(tagId);
    toggleContactTag(detail.contact.id, tagId, !currentlyOn)
      .then(async () => {
        setDetail(await getOpportunityDetailAction(opportunityId));
        onChanged();
      })
      .catch(() => toast.error("No se pudo actualizar la etiqueta."))
      .finally(() => setTogglingTagId(null));
  }

  function handleDelete() {
    if (!opportunityId) return;
    setDeleting(true);
    deleteOpportunity(opportunityId)
      .then(() => {
        toast.success("Lead eliminado.");
        setDeleteOpen(false);
        onChanged();
        onClose();
      })
      .catch(() => toast.error("No se pudo eliminar el lead."))
      .finally(() => setDeleting(false));
  }

  const channel = detail ? resolveChannel(detail.contact.source) : null;
  const ChannelIcon = channel ? CHANNEL_ICON[channel] : null;
  const latestConversation = conversations[0] ?? null;
  const latestConversationChannel = latestConversation ? resolveChannel(latestConversation.channel) : null;
  const LatestConversationIcon = latestConversationChannel ? CHANNEL_ICON[latestConversationChannel] : null;
  const sourceRows = detail ? sourceDetailRows(detail.contact.sourceDetails) : null;

  return (
    <Sheet
      open={opportunityId !== null}
      onClose={onClose}
      title={
        detail ? (
          <div className="flex items-center gap-2.5">
            <Avatar name={detail.contact.name} size={36} />
            <div className="min-w-0">
              <p className="truncate text-[14px] leading-tight font-semibold text-foreground">{detail.contact.name}</p>
              <p className="truncate text-xs leading-tight text-neutral-500">{detail.title}</p>
            </div>
          </div>
        ) : (
          "Oportunidad"
        )
      }
    >
      {!detail ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex flex-col gap-2 border-b border-border-default px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-base font-semibold text-foreground">{formatCurrency(detail.value, detail.currency)}</p>
              <Badge variant={PRIORITY_VARIANT[detail.priority]}>{PRIORITY_LABEL[detail.priority]}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
              {ChannelIcon && channel && (
                <span className="flex items-center gap-1.5">
                  <ChannelIcon size={13} aria-hidden="true" />
                  {CHANNEL_LABEL[channel]}
                </span>
              )}
              <select
                value={detail.stageId ?? ""}
                disabled={movingStage}
                onChange={(e) => e.target.value && handleMoveStage(e.target.value)}
                aria-label="Etapa"
                className="ml-auto rounded-full border border-border-default bg-surface-1 px-2.5 py-1 text-[12px] font-medium text-foreground outline-none disabled:opacity-50"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border-default px-5 py-2.5">
            {detail.contact.phone && (
              <>
                <a
                  href={waLink(detail.contact.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default py-1.5 text-xs font-medium text-foreground hover:border-success-strong hover:text-success-strong"
                >
                  <MessageCircle size={14} aria-hidden="true" />
                  WhatsApp
                </a>
                <a
                  href={`tel:${detail.contact.phone}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default py-1.5 text-xs font-medium text-foreground hover:border-accent-500 hover:text-accent-700"
                >
                  <Phone size={14} aria-hidden="true" />
                  Llamar
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() => setTab("tareas")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default py-1.5 text-xs font-medium text-foreground hover:border-accent-500 hover:text-accent-700"
            >
              <ListTodo size={14} aria-hidden="true" />
              Tarea
            </button>
            <button
              type="button"
              onClick={() => setTab("notas")}
              title="Más acciones"
              aria-label="Más acciones"
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:border-accent-500 hover:text-accent-700"
            >
              <MoreHorizontal size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pt-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as DrawerTab)}>
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="actividad">Actividad</TabsTrigger>
                <TabsTrigger value="conversaciones">Conversaciones</TabsTrigger>
                <TabsTrigger value="notas">Notas</TabsTrigger>
                <TabsTrigger value="tareas">Tareas</TabsTrigger>
                <TabsTrigger value="archivos">Archivos</TabsTrigger>
                <TabsTrigger value="reuniones">Reuniones</TabsTrigger>
              </TabsList>

              <div className="py-4">
                <TabsContent value="resumen">
                  <div className="flex flex-col gap-5">
                    <section className="flex flex-col gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Información comercial</p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                        <div>
                          <dt className="text-xs text-neutral-500">Estado</dt>
                          <dd className="mt-0.5">
                            <Badge variant={detail.status === "won" ? "success" : "neutral"}>{detail.status}</Badge>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500">Valor</dt>
                          <dd className="mt-0.5 font-mono text-foreground">{formatCurrency(detail.value, detail.currency)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500">Probabilidad de cierre</dt>
                          <dd className="mt-0.5 text-foreground">{detail.probability !== null ? `${detail.probability}%` : "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500">Moneda</dt>
                          <dd className="mt-0.5 text-foreground">{detail.currency}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500">Fecha de cierre estimada</dt>
                          <dd className="mt-0.5 flex items-center gap-1.5 text-foreground">
                            {detail.expectedCloseDate ? formatDateOnly(detail.expectedCloseDate) : "—"}
                            {detail.expectedCloseDate && (
                              <Link
                                href={`/calendar?view=day&date=${detail.expectedCloseDate}${detail.calendarEventId ? `&event=${detail.calendarEventId}` : ""}`}
                                className="text-[11px] text-accent-600 hover:underline"
                              >
                                Ver
                              </Link>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500">Creado</dt>
                          <dd className="mt-0.5 text-foreground">{formatEventDate(detail.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500">Etapa</dt>
                          <dd className="mt-0.5 text-foreground">{stages.find((s) => s.id === detail.stageId)?.name ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500">Responsable</dt>
                          <dd className="mt-0.5 text-foreground">{detail.ownerName ?? "Sin asignar"}</dd>
                        </div>
                      </dl>
                    </section>

                    <div className="h-px bg-border-default" />

                    <section className="flex flex-col gap-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Contacto</p>
                      <dl className="flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <dt className="text-neutral-500">Nombre</dt>
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
                            <dd className="flex items-center gap-1.5 truncate text-foreground">
                              <a href={`mailto:${detail.contact.email}`} className="truncate hover:underline">
                                {detail.contact.email}
                              </a>
                              <Mail size={12} className="shrink-0 text-neutral-400" aria-hidden="true" />
                            </dd>
                          </div>
                        )}
                        {detail.contact.phone && (
                          <div className="flex items-center justify-between">
                            <dt className="text-neutral-500">Teléfono</dt>
                            <dd className="flex items-center gap-1.5 text-foreground">
                              <a href={`tel:${detail.contact.phone}`} className="hover:underline">
                                {detail.contact.phone}
                              </a>
                              <a href={waLink(detail.contact.phone)} target="_blank" rel="noreferrer" title="WhatsApp">
                                <MessageCircle size={12} className="shrink-0 text-success-strong" aria-hidden="true" />
                              </a>
                            </dd>
                          </div>
                        )}
                        {detail.contact.jobTitle && (
                          <div className="flex items-center justify-between">
                            <dt className="text-neutral-500">Cargo</dt>
                            <dd className="text-foreground">{detail.contact.jobTitle}</dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    <div className="h-px bg-border-default" />

                    <section className="flex flex-col gap-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Origen del lead</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500">Fuente</span>
                        <span className="flex items-center gap-1.5 text-foreground">
                          {ChannelIcon && channel && <ChannelIcon size={13} className="text-neutral-400" aria-hidden="true" />}
                          {channel && detail.contact.source && detail.contact.source !== CHANNEL_LABEL[channel].toLowerCase()
                            ? `${CHANNEL_LABEL[channel]} (${detail.contact.source})`
                            : (channel ? CHANNEL_LABEL[channel] : "—")}
                        </span>
                      </div>
                      {sourceRows?.map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-neutral-500">{label}</span>
                          <span className="truncate text-foreground">{value}</span>
                        </div>
                      ))}
                    </section>

                    {latestConversation && (
                      <>
                        <div className="h-px bg-border-default" />
                        <section className="flex flex-col gap-2.5">
                          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Canal actual</p>
                          <button
                            type="button"
                            onClick={() => setTab("conversaciones")}
                            className="flex items-center justify-between gap-2 text-sm hover:text-accent-700"
                          >
                            <span className="flex items-center gap-1.5 text-foreground">
                              {LatestConversationIcon && <LatestConversationIcon size={13} className="text-neutral-400" aria-hidden="true" />}
                              {latestConversationChannel && CHANNEL_LABEL[latestConversationChannel]}
                            </span>
                            <span className="flex items-center gap-1 text-neutral-500">
                              {CONVERSATION_STATUS_LABEL[latestConversation.status] ?? latestConversation.status}
                              <ChevronRight size={13} aria-hidden="true" />
                            </span>
                          </button>
                        </section>
                      </>
                    )}

                    <div className="h-px bg-border-default" />

                    <section className="flex flex-col gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Etiquetas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.length === 0 && <p className="text-xs text-neutral-500">Todavía no hay etiquetas en el workspace.</p>}
                        {tags.map((t) => {
                          const isOn = detail.tags.some((dt) => dt.id === t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              disabled={togglingTagId === t.id}
                              onClick={() => handleToggleTag(t.id, isOn)}
                              className={isOn ? "" : "opacity-40 hover:opacity-70"}
                            >
                              <Badge variant={tagBadgeVariant(t.color)}>{t.name}</Badge>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </TabsContent>

                <TabsContent value="actividad">
                  {!activityLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <ul className="flex flex-col">
                      {/* Fallback for opportunities created before this feature shipped — no
                         audit_log row exists for their creation, so `createdAt` is the only signal. */}
                      {!activity.some((a) => a.action === "Oportunidad creada") && (
                        <li className="flex gap-3 pb-4">
                          <span className="relative flex shrink-0 flex-col items-center">
                            <span className="flex size-6 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                              <Plus size={12} aria-hidden="true" />
                            </span>
                            <span className="mt-1 w-px flex-1 bg-border-default" />
                          </span>
                          <div className="pb-1">
                            <p className="text-sm font-medium text-foreground">Oportunidad creada</p>
                            <p className="mt-0.5 text-xs text-neutral-500">{formatDate(detail.createdAt)}</p>
                          </div>
                        </li>
                      )}
                      {activity.map((a, i) => {
                        const Icon = activityIcon(a.action);
                        const isLast = i === activity.length - 1;
                        return (
                          <li key={a.id} className="flex gap-3 pb-4 last:pb-0">
                            <span className="relative flex shrink-0 flex-col items-center">
                              <span className="flex size-6 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                                <Icon size={12} aria-hidden="true" />
                              </span>
                              {!isLast && <span className="mt-1 w-px flex-1 bg-border-default" />}
                            </span>
                            <div className="pb-1">
                              <p className="text-sm font-medium text-foreground">
                                {a.action}
                                {a.metadata.from_stage && a.metadata.to_stage
                                  ? `: ${a.metadata.from_stage} → ${a.metadata.to_stage}`
                                  : ""}
                              </p>
                              <p className="mt-0.5 text-xs text-neutral-500">
                                {formatDate(a.createdAt)}
                                {a.actorName && ` · ${a.actorName}`}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="conversaciones">
                  {!conversationsLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : conversations.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin conversaciones todavía.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {conversations.map((conv) => {
                        const convChannel = resolveChannel(conv.channel);
                        const Icon = CHANNEL_ICON[convChannel];
                        return (
                          <li key={conv.id} className="rounded-lg bg-surface-2 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                                <Icon size={13} aria-hidden="true" />
                                {CHANNEL_LABEL[convChannel]}
                              </span>
                              <Link href={`/inbox?conversation=${conv.id}`} className="text-[12px] text-accent-600 hover:underline">
                                Abrir en Inbox →
                              </Link>
                            </div>
                            {conv.recentMessages.length === 0 ? (
                              <p className="text-sm text-neutral-500">Sin mensajes.</p>
                            ) : (
                              <ul className="flex flex-col gap-1.5">
                                {conv.recentMessages.map((m) => (
                                  <li key={m.id} className="text-sm">
                                    <span className={m.direction === "outbound" ? "text-accent-700" : "text-foreground"}>
                                      {m.direction === "outbound" ? "Nosotros: " : "Contacto: "}
                                    </span>
                                    <span className="text-foreground">{m.preview}</span>
                                    <span className="ml-1.5 text-xs text-neutral-400">{formatDate(m.createdAt)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="notas">
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                        placeholder="Agregar una nota…"
                        className="flex-1 rounded-full border border-border-default bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                      />
                      <Button size="sm" onClick={handleAddNote} loading={isPending}>
                        Agregar
                      </Button>
                    </div>
                    {detail.notes.length === 0 ? (
                      <p className="text-sm text-neutral-500">Sin notas todavía.</p>
                    ) : (
                      <ul className="flex flex-col gap-2.5">
                        {detail.notes.map((note) => (
                          <li key={note.id} className="rounded-lg border border-[#F0DFA8] bg-[#FBF3D9] p-3 dark:border-[#4a3f1a] dark:bg-[#2b2412]">
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
                        className="flex-1 rounded-full border border-border-default bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                      />
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="rounded-full border border-border-default bg-surface-1 px-2 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
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
                      <>
                        {tasks.some((t) => t.status !== "completed") && (
                          <ul className="flex flex-col gap-2">
                            {tasks
                              .filter((t) => t.status !== "completed")
                              .map((task) => (
                                <li key={task.id} className="flex items-center gap-2 rounded-lg bg-surface-2 p-3">
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteTask(task.id)}
                                    className="shrink-0 text-neutral-400 hover:text-success-strong"
                                    aria-label="Marcar completada"
                                  >
                                    <Circle size={17} aria-hidden="true" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-foreground">{task.title}</p>
                                    {task.dueAt && <p className="text-xs text-neutral-500">Vence: {formatEventDate(task.dueAt)}</p>}
                                  </div>
                                  <Link href={`/tasks/${task.id}`} className="shrink-0 text-[12px] text-accent-600 hover:underline">
                                    Abrir en Workspace →
                                  </Link>
                                </li>
                              ))}
                          </ul>
                        )}
                        {tasks.some((t) => t.status === "completed") && (
                          <>
                            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Completadas</p>
                            <ul className="flex flex-col gap-2">
                              {tasks
                                .filter((t) => t.status === "completed")
                                .map((task) => (
                                  <li key={task.id} className="flex items-center gap-2 rounded-lg bg-surface-2 p-3">
                                    <CheckCircle2 size={17} className="shrink-0 text-success-strong" aria-hidden="true" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm text-neutral-400 line-through">{task.title}</p>
                                      {task.dueAt && <p className="text-xs text-neutral-500">Vence: {formatEventDate(task.dueAt)}</p>}
                                    </div>
                                    <Link href={`/tasks/${task.id}`} className="shrink-0 text-[12px] text-accent-600 hover:underline">
                                      Abrir en Workspace →
                                    </Link>
                                  </li>
                                ))}
                            </ul>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="archivos">
                  <div className="flex flex-col gap-3">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-3 text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
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
                      <p className="text-sm text-neutral-500">No hay archivos asociados.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {documents.map((doc) => {
                          const meta = fileTypeMetaFor(doc.name);
                          const Icon = meta.icon;
                          return (
                            <li key={doc.id} className="flex items-center gap-2 rounded-lg bg-surface-2 p-3">
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
                    <>
                      {events.some((e) => new Date(e.endTime) >= new Date()) && (
                        <ul className="flex flex-col gap-3">
                          {events
                            .filter((e) => new Date(e.endTime) >= new Date())
                            .map((event) => (
                              <li key={event.id} className="rounded-lg bg-surface-2 p-3">
                                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                  <CalendarDays size={14} aria-hidden="true" />
                                  Próxima reunión
                                </p>
                                <p className="mt-1 text-sm text-foreground">{event.title}</p>
                                <p className="mt-1 text-xs text-neutral-500">
                                  Fecha: {formatEventDate(event.startTime)} · Hora: {formatEventTime(event.startTime)}
                                  {event.assignedTo && ` · Responsable: ${event.assignedTo.fullName}`}
                                </p>
                              </li>
                            ))}
                        </ul>
                      )}
                      {events.some((e) => new Date(e.endTime) < new Date()) && (
                        <>
                          <p className="mt-3 mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Anteriores</p>
                          <ul className="flex flex-col gap-3">
                            {events
                              .filter((e) => new Date(e.endTime) < new Date())
                              .map((event) => (
                                <li key={event.id} className="rounded-lg bg-surface-2 p-3">
                                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                    <CalendarDays size={14} aria-hidden="true" />
                                    Reunión agendada
                                  </p>
                                  <p className="mt-1 text-sm text-foreground">{event.title}</p>
                                  <p className="mt-1 text-xs text-neutral-500">
                                    Fecha: {formatEventDate(event.startTime)} · Hora: {formatEventTime(event.startTime)}
                                    {event.assignedTo && ` · Responsable: ${event.assignedTo.fullName}`}
                                  </p>
                                </li>
                              ))}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="flex items-center gap-2 border-t border-border-default px-5 py-3">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Editar lead
            </Button>
            <select
              defaultValue=""
              disabled={movingStage}
              onChange={(e) => {
                if (e.target.value) handleMoveStage(e.target.value);
                e.target.value = "";
              }}
              className="rounded-full border border-border-strong bg-surface-1 px-3 py-1.5 text-[13px] font-medium text-foreground outline-none disabled:opacity-50"
            >
              <option value="" disabled>
                Mover etapa…
              </option>
              {stages.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === detail.stageId}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-error-strong hover:bg-error-bg"
            >
              <Trash2 size={14} aria-hidden="true" />
              Eliminar
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={`¿Eliminar "${detail?.title ?? "este lead"}"?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </Sheet>
  );
}
