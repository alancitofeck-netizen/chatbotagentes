"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Mail,
  Phone,
  Building2,
  Briefcase,
  Tag as TagIcon,
  StickyNote,
  Clock,
  MessageCircle,
  Kanban,
  Calendar,
  ListTodo,
  Users2,
  ExternalLink,
  Plus,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import { formatCurrency } from "@/lib/utils/format";
import type { ConversationDetail, WorkspaceMemberOption, WorkspaceTag } from "@/lib/inbox/queries";
import type { ContactCrmSummary } from "@/lib/inbox/queries";
import {
  updateConversationStatus,
  updateConversationMode,
  assignConversation,
  addConversationNote,
  toggleContactTag,
  getContactCrmSummaryAction,
  movePipelineStageAction,
} from "@/lib/inbox/actions";
import { createTask } from "@/lib/tasks/actions";
import { getPoliciesForContactAction } from "@/lib/policies/actions";
import type { ContactPolicySummary } from "@/lib/policies/queries";
import { POLICY_STATUS_BADGE_VARIANT, POLICY_STAGES } from "@/lib/policies/constants";
import { tagBadgeVariant } from "./tagColor";
import { MergeContactDialog } from "./MergeContactDialog";
import { INBOX_PRIMARY, INBOX_SECONDARY, inboxSecondaryButton } from "./inboxColors";

const POLICY_STAGE_NAME_BY_KEY = new Map(POLICY_STAGES.map((s) => [s.key, s.name]));

const STATUS_OPTIONS = [
  { value: "open", label: "Abierta" },
  { value: "pending_human", label: "Esperando" },
  { value: "closed", label: "Cerrada" },
];

/** Motor de IA (docs/blueprint/13-agent-engine.md): decide si el Buffer
 * Inteligente invoca al Agent Runtime al hacer flush de esta conversación.
 * `mode` existía en el schema desde el core de Inbox pero nunca se leía ni
 * escribía en ningún lado hasta este pase. */
const MODE_OPTIONS = [
  { value: "human", label: "Humano" },
  { value: "ai", label: "IA" },
  { value: "hybrid", label: "Híbrido (sugerido, no enviado)" },
  // Fase 4 (Agentes IA de Referidos): "nadie está atendiendo activamente,
  // seguimientos cancelados" — decisionEngine.ts lo trata igual que
  // 'human' (el agente nunca se invoca), pero es semánticamente distinto
  // de que el asesor esté atendiendo ahora.
  { value: "paused", label: "Pausado" },
];

const COMING_SOON_TABS = ["archivos"];
const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "notas", label: "Notas" },
  { value: "historial", label: "Historial" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  manual: "Alta manual",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function tabButtonClass(active: boolean) {
  return [
    "shrink-0 border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors duration-150",
    active ? `border-blue-600 text-foreground` : "border-transparent text-neutral-500 hover:text-foreground",
  ].join(" ");
}

export function ContactInfoPanel({
  detail,
  loading,
  members,
  tags,
  onChanged,
}: {
  detail: ConversationDetail | null;
  loading: boolean;
  members: WorkspaceMemberOption[];
  tags: WorkspaceTag[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState("resumen");
  const [noteBody, setNoteBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const [crm, setCrm] = useState<ContactCrmSummary | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [policies, setPolicies] = useState<ContactPolicySummary[] | null>(null);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [movingStage, setMovingStage] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [notePopoverOpen, setNotePopoverOpen] = useState(false);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const notePopoverRef = useRef<HTMLDivElement>(null);

  // "Agregar etiqueta"/"Agregar nota" quick actions — mismo criterio de
  // click-outside-to-close que ya usa el popover de Respuestas rápidas del
  // composer (ConversationThread.tsx).
  useEffect(() => {
    if (!tagPopoverOpen && !notePopoverOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (tagPopoverOpen && tagPopoverRef.current && !tagPopoverRef.current.contains(e.target as Node)) setTagPopoverOpen(false);
      if (notePopoverOpen && notePopoverRef.current && !notePopoverRef.current.contains(e.target as Node)) setNotePopoverOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tagPopoverOpen, notePopoverOpen]);

  useEffect(() => {
    if (!detail) {
      Promise.resolve().then(() => setCrm(null));
      return;
    }
    Promise.resolve().then(() => setCrmLoading(true));
    getContactCrmSummaryAction(detail.contact.id, detail.id).then((data) => {
      setCrm(data);
      setCrmLoading(false);
    });
    // Keyed only on the ids: `detail` also changes reference after
    // onChanged()/refetchDetail() (note/tag/status edits), which shouldn't
    // re-trigger this fetch — same convention as ConversationThread's own
    // Realtime effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detail?.contact.id]);

  useEffect(() => {
    if (!detail) {
      Promise.resolve().then(() => setPolicies(null));
      return;
    }
    Promise.resolve().then(() => setPoliciesLoading(true));
    getPoliciesForContactAction(detail.contact.id).then((data) => {
      setPolicies(data);
      setPoliciesLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.contact.id]);

  /** "Pedir documentación" (pedido explícito de integración con Inbox) —
   * copia un mensaje al portapapeles en vez de auto-enviarlo o intentar
   * inyectarlo en el composer de la conversación: mismo criterio ya usado
   * en el motor de automatizaciones de Pólizas, el asesor siempre revisa
   * antes de mandar algo a un cliente. */
  function handleCopyDocumentRequest(policy: ContactPolicySummary) {
    if (!detail) return;
    const label = policy.policyNumber ? `póliza ${policy.policyNumber}` : "tu póliza";
    const message = `Hola ${detail.contact.name}, para avanzar con ${label} de ${policy.company} necesitamos que nos envíes la documentación pendiente. ¿Podés mandarla cuando puedas?`;
    navigator.clipboard.writeText(message);
    toast.success("Mensaje copiado — pegalo en el chat.");
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-5 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!detail) {
    return <div className="p-5 text-sm text-neutral-500">Seleccioná una conversación para ver sus detalles.</div>;
  }

  function handleStatusChange(status: string) {
    if (!detail) return;
    startTransition(async () => {
      await updateConversationStatus(detail.id, status);
      onChanged();
      toast.success("Estado actualizado.");
    });
  }

  function handleModeChange(mode: string) {
    if (!detail) return;
    startTransition(async () => {
      await updateConversationMode(detail.id, mode);
      onChanged();
      toast.success("Modo actualizado.");
    });
  }

  function handleAssign(memberId: string) {
    if (!detail) return;
    startTransition(async () => {
      await assignConversation(detail.id, memberId || null);
      onChanged();
      toast.success("Conversación asignada.");
    });
  }

  function handleAddNote() {
    if (!detail || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addConversationNote(detail.id, body);
      onChanged();
      toast.success("Nota agregada.");
    });
  }

  function handleToggleTag(tagId: string, enabled: boolean) {
    if (!detail) return;
    startTransition(async () => {
      await toggleContactTag(detail.contact.id, tagId, enabled);
      onChanged();
    });
  }

  function handleMoveStage(stageId: string) {
    if (!detail || !crm?.opportunity || !stageId || stageId === crm.opportunity.stageId) return;
    setMovingStage(true);
    movePipelineStageAction(crm.opportunity.pipelineItemId, stageId)
      .then(() => {
        toast.success("Etapa actualizada.");
        return getContactCrmSummaryAction(detail.contact.id, detail.id).then(setCrm);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo mover la etapa."))
      .finally(() => setMovingStage(false));
  }

  function handleCreateTask() {
    if (!detail || !newTaskTitle.trim()) return;
    setCreatingTask(true);
    createTask({
      title: newTaskTitle.trim(),
      description: "",
      priority: "medium",
      dueAt: null,
      assignedTo: "",
      relatedType: "conversation",
      relatedId: detail.id,
    })
      .then(() => {
        toast.success("Tarea creada.");
        setNewTaskTitle("");
        setShowTaskForm(false);
        return getContactCrmSummaryAction(detail.contact.id, detail.id).then(setCrm);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea."))
      .finally(() => setCreatingTask(false));
  }

  const lastMessage = detail.messages[detail.messages.length - 1] ?? null;

  // Real activity feed built only from data already fetched — no invented
  // audit trail: every note (with its own timestamp) plus the last message,
  // merged and sorted newest-first.
  const activity = [
    ...detail.notes.map((n) => ({ id: `note-${n.id}`, at: n.createdAt, label: "Nota agregada", detail: n.body })),
    ...(lastMessage
      ? [
          {
            id: "last-message",
            at: lastMessage.createdAt,
            label: lastMessage.direction === "inbound" ? "Mensaje recibido" : "Mensaje enviado",
            detail: lastMessage.body,
          },
        ]
      : []),
  ].sort((a, b) => (a.at > b.at ? -1 : 1));

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-1">
      <div className="flex flex-col items-center gap-3 border-b border-border-default px-5 pb-5 pt-6">
        <Avatar name={detail.contact.name} src={detail.contact.avatarUrl} size={80} />
        <div className="text-center">
          <p className="text-[16px] font-semibold text-foreground">{detail.contact.name}</p>
          {(detail.contact.jobTitle || detail.contact.company) && (
            <p className="text-[13px] text-neutral-500">
              {[detail.contact.jobTitle, detail.contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {/* Acciones rápidas — Editar contacto / Abrir en CRM / Crear tarea /
            Programar reunión / Agregar etiqueta / Agregar nota / Fusionar
            (pedido explícito). "Abrir en CRM" ahora siempre visible: antes
            solo aparecía si ya existía una oportunidad activa, escondiendo
            la acción justo cuando más falta hace (crear una desde cero). */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Link href="/inbox/contactos" className={inboxSecondaryButton}>
            <Users2 size={13} /> Editar contacto
          </Link>
          <Link href="/crm" className={inboxSecondaryButton}>
            <Kanban size={13} /> Abrir en CRM
          </Link>
          <button type="button" onClick={() => setShowTaskForm((v) => !v)} className={inboxSecondaryButton}>
            <ListTodo size={13} /> Crear tarea
          </button>
          <Link
            href={`/calendar?view=day&createContact=${detail.contact.id}&createName=${encodeURIComponent(detail.contact.name)}${detail.contact.company ? `&createCompany=${encodeURIComponent(detail.contact.company)}` : ""}`}
            className={inboxSecondaryButton}
          >
            <Calendar size={13} /> Programar reunión
          </Link>
          <Link
            href={`/polizas?createContact=${detail.contact.id}&createName=${encodeURIComponent(detail.contact.name)}${detail.contact.phone ? `&createPhone=${encodeURIComponent(detail.contact.phone)}` : ""}${detail.contact.email ? `&createEmail=${encodeURIComponent(detail.contact.email)}` : ""}`}
            className={inboxSecondaryButton}
          >
            <ShieldCheck size={13} /> Nueva póliza
          </Link>
          <div className="relative" ref={tagPopoverRef}>
            <button type="button" onClick={() => setTagPopoverOpen((v) => !v)} className={inboxSecondaryButton} aria-expanded={tagPopoverOpen}>
              <TagIcon size={13} /> Agregar etiqueta
            </button>
            {tagPopoverOpen && (
              <div className="absolute left-1/2 top-full z-10 mt-1.5 w-56 -translate-x-1/2 rounded-md border border-border-default bg-surface-1 p-2.5 shadow-[var(--elevation-md)]">
                {tags.length === 0 ? (
                  <p className="text-xs text-neutral-500">No hay etiquetas en este workspace.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => {
                      const active = detail.tags.some((dt) => dt.id === t.id);
                      return (
                        <button key={t.id} type="button" disabled={isPending} onClick={() => handleToggleTag(t.id, !active)} className="disabled:opacity-50">
                          <Badge variant={active ? tagBadgeVariant(t.color) : "neutral"} className={active ? "" : "opacity-60"}>
                            {t.name}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative" ref={notePopoverRef}>
            <button type="button" onClick={() => setNotePopoverOpen((v) => !v)} className={inboxSecondaryButton} aria-expanded={notePopoverOpen}>
              <StickyNote size={13} /> Agregar nota
            </button>
            {notePopoverOpen && (
              <div className="absolute left-1/2 top-full z-10 mt-1.5 w-64 -translate-x-1/2 rounded-md border border-border-default bg-surface-1 p-2.5 shadow-[var(--elevation-md)]">
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddNote();
                        setNotePopoverOpen(false);
                      }
                    }}
                    placeholder="Escribí una nota…"
                    className="flex-1 rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-[13px] outline-none focus:border-blue-500 focus:bg-surface-1"
                  />
                  <button
                    type="button"
                    disabled={isPending || !noteBody.trim()}
                    onClick={() => {
                      handleAddNote();
                      setNotePopoverOpen(false);
                    }}
                    className={`${INBOX_PRIMARY.bg} ${INBOX_PRIMARY.bgHover} shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setMergeOpen(true)} className={inboxSecondaryButton}>
            <Users2 size={13} /> Fusionar
          </button>
        </div>

        {showTaskForm && (
          <div className="flex w-full items-center gap-1.5">
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
              className={`${INBOX_PRIMARY.bg} ${INBOX_PRIMARY.bgHover} rounded-full px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40`}
            >
              Crear
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pt-4">
        <div role="tablist" className="flex gap-5 border-b border-border-default">
          {TABS.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)} className={tabButtonClass(tab === t.value)}>
              {t.label}
              {t.value === "notas" && detail.notes.length > 0 ? ` (${detail.notes.length})` : ""}
            </button>
          ))}
          {COMING_SOON_TABS.map((t) => (
            <span key={t} className="shrink-0 cursor-default border-b-2 border-transparent px-0.5 py-2.5 text-sm font-medium text-neutral-400">
              {t[0].toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>

        <div className="py-4">
          {tab === "resumen" && (
            <div className="flex flex-col gap-5">
              <section className="flex flex-col gap-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Datos de contacto</h3>
                {detail.contact.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail size={15} className="shrink-0 text-neutral-400" />
                    <a href={`mailto:${detail.contact.email}`} className="truncate text-foreground hover:text-blue-600 hover:underline">
                      {detail.contact.email}
                    </a>
                  </div>
                )}
                {detail.contact.phone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={15} className="shrink-0 text-neutral-400" />
                    <a href={`tel:${detail.contact.phone}`} className="text-foreground hover:text-blue-600 hover:underline">
                      {detail.contact.phone}
                    </a>
                  </div>
                )}
                {detail.contact.company && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Building2 size={15} className="shrink-0 text-neutral-400" />
                    <span className="text-foreground">{detail.contact.company}</span>
                  </div>
                )}
                {detail.contact.jobTitle && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Briefcase size={15} className="shrink-0 text-neutral-400" />
                    <span className="text-foreground">{detail.contact.jobTitle}</span>
                  </div>
                )}
                {detail.contact.instagramUsername && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="shrink-0 text-fuchsia-600">🟣</span>
                    <a
                      href={`https://instagram.com/${detail.contact.instagramUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-foreground hover:text-blue-600 hover:underline"
                    >
                      @{detail.contact.instagramUsername}
                    </a>
                  </div>
                )}
                {!detail.contact.email && !detail.contact.phone && !detail.contact.company && !detail.contact.jobTitle && !detail.contact.instagramUsername && (
                  <p className="text-[13px] text-neutral-500">Sin datos de contacto adicionales.</p>
                )}
              </section>

              <section className="flex flex-col gap-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Lead</h3>
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="text-neutral-500">Origen</span>
                  <span className={`rounded-full ${INBOX_PRIMARY.tint} ${INBOX_PRIMARY.tintText} px-2.5 py-0.5 text-xs font-medium`}>
                    {(detail.contact.source && SOURCE_LABELS[detail.contact.source]) || detail.contact.source || "Sin origen"}
                  </span>
                </div>
              </section>

              {/* CRM: pipeline / etapa / valor / owner — pedido explícito
                  ("Pipeline, Etapa, Owner" en el panel derecho), con acción de
                  "Mover pipeline" inline (reusa moveOpportunityCard del board). */}
              <section className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <Kanban size={12} /> CRM
                </h3>
                {crmLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : crm?.opportunity ? (
                  <div className={`flex flex-col gap-2 rounded-lg ${INBOX_PRIMARY.tint} p-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${INBOX_PRIMARY.tintText}`}>{formatCurrency(crm.opportunity.value, crm.opportunity.currency)}</span>
                      <span className="text-xs text-neutral-500">{crm.opportunity.pipelineName}</span>
                    </div>
                    <Select label="Etapa" value={crm.opportunity.stageId} onChange={(e) => handleMoveStage(e.target.value)} disabled={movingStage}>
                      {crm.opportunity.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                    {crm.opportunity.ownerName && <p className="text-xs text-neutral-500">Responsable: {crm.opportunity.ownerName}</p>}
                  </div>
                ) : (
                  <p className="text-[13px] text-neutral-500">Este contacto no tiene una oportunidad activa en el CRM.</p>
                )}
              </section>

              {/* KPIs del contacto — solo números reales derivados de datos
                  existentes, nunca inventados. */}
              <section className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">KPIs del contacto</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border-default p-2.5">
                    <p className="text-lg font-semibold text-foreground">{crm?.totalMessages ?? "—"}</p>
                    <p className="text-[11px] text-neutral-500">Mensajes</p>
                  </div>
                  <div className="rounded-lg border border-border-default p-2.5">
                    <p className="text-lg font-semibold text-foreground">{crm?.firstContactAt ? formatDateShort(crm.firstContactAt) : "—"}</p>
                    <p className="text-[11px] text-neutral-500">Cliente desde</p>
                  </div>
                </div>
              </section>

              {/* Pólizas — "cada cliente debe mostrar automáticamente todas
                  sus pólizas" (pedido explícito del módulo Pólizas). */}
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <ShieldCheck size={12} /> Pólizas
                </h3>
                {policiesLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : policies && policies.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {policies.map((p) => (
                      <li key={p.id} className={`flex flex-col gap-1 rounded-md ${INBOX_SECONDARY.tint} px-2.5 py-1.5`}>
                        <Link href={`/polizas?policy=${p.id}`} className="flex flex-col gap-1 hover:opacity-80">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-[13px] font-medium ${INBOX_SECONDARY.tintText}`}>{p.company}</span>
                            <Badge variant={POLICY_STATUS_BADGE_VARIANT[p.status]}>{POLICY_STAGE_NAME_BY_KEY.get(p.status) ?? p.status}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span>{p.product ?? p.policyNumber ?? "—"}</span>
                            {p.premium !== null && <span>{formatCurrency(p.premium, p.premiumCurrency)}</span>}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleCopyDocumentRequest(p)}
                          className="self-start text-[11px] font-medium text-neutral-500 hover:text-foreground hover:underline"
                        >
                          Copiar pedido de documentación
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-neutral-500">Este contacto no tiene pólizas cargadas.</p>
                )}
              </section>

              {/* Próximas reuniones */}
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <Calendar size={12} /> Próximas reuniones
                </h3>
                {crm && crm.upcomingBookings.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {crm.upcomingBookings.map((b) => (
                      <li key={b.id} className={`flex items-center justify-between rounded-md ${INBOX_SECONDARY.tint} px-2.5 py-1.5 text-[13px]`}>
                        <span className={`truncate ${INBOX_SECONDARY.tintText}`}>{b.subject}</span>
                        <span className="shrink-0 text-xs text-neutral-500">{formatDate(b.startTime)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-neutral-500">Sin reuniones programadas.</p>
                )}
              </section>

              {/* Tareas relacionadas (conversación + oportunidad activa) */}
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <ListTodo size={12} /> Tareas relacionadas
                </h3>
                {crm && crm.relatedTasks.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {crm.relatedTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded-md border border-border-default px-2.5 py-1.5 text-[13px]">
                        <span className="truncate text-foreground">{t.title}</span>
                        {t.dueAt && <span className="shrink-0 text-xs text-neutral-500">{formatDateShort(t.dueAt)}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-neutral-500">Sin tareas pendientes.</p>
                )}
                <Link href="/tasks" className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline">
                  Ver todas en Tareas <ExternalLink size={11} />
                </Link>
              </section>

              <section className="flex flex-col gap-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Conversación</h3>
                <Select label="Estado" value={detail.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={isPending}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>

                <Select label="Modo" value={detail.mode} onChange={(e) => handleModeChange(e.target.value)} disabled={isPending}>
                  {MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>

                <Select label="Asignado a" value={detail.assignedMemberId ?? ""} onChange={(e) => handleAssign(e.target.value)} disabled={isPending}>
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.fullName}
                    </option>
                  ))}
                </Select>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <TagIcon size={12} /> Etiquetas
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {tags.length === 0 && <p className="text-xs text-neutral-500">No hay etiquetas en este workspace.</p>}
                  {tags.map((t) => {
                    const active = detail.tags.some((dt) => dt.id === t.id);
                    return (
                      <button key={t.id} type="button" disabled={isPending} onClick={() => handleToggleTag(t.id, !active)} className="disabled:opacity-50">
                        <Badge variant={active ? tagBadgeVariant(t.color) : "neutral"} className={active ? "" : "opacity-60"}>
                          {t.name}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === "notas" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  placeholder="Agregar una nota…"
                  className="flex-1 rounded-full border border-border-strong bg-surface-2 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:bg-surface-1 focus:ring-[3px] focus:ring-blue-100"
                />
                <button type="button" onClick={handleAddNote} disabled={isPending} className={`${INBOX_PRIMARY.bg} ${INBOX_PRIMARY.bgHover} shrink-0 rounded-full px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40`}>
                  <Plus size={15} />
                </button>
              </div>
              {detail.notes.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin notas todavía.</p>
              ) : (
                <ul className="flex flex-col gap-3 border-l-2 border-border-default pl-3.5">
                  {detail.notes.map((note) => (
                    <li key={note.id} className="relative rounded-md bg-surface-2 p-3">
                      <span className={`absolute -left-[19px] top-4 size-2 rounded-full ${INBOX_PRIMARY.dot}`} aria-hidden="true" />
                      <p className="text-sm text-foreground">{note.body}</p>
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-neutral-500">
                        <StickyNote size={11} /> {formatDate(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "historial" &&
            (activity.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin actividad todavía.</p>
            ) : (
              <ul className="flex flex-col gap-3 border-l-2 border-border-default pl-3.5">
                {activity.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[19px] top-1 size-2 rounded-full bg-neutral-400" aria-hidden="true" />
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                      {a.label.startsWith("Mensaje") ? <MessageCircle size={12} /> : <StickyNote size={12} />}
                      {a.label}
                    </p>
                    <p className="truncate text-[13px] text-neutral-500">{a.detail}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                      <Clock size={10} /> {formatDate(a.at)}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>

      <MergeContactDialog
        open={mergeOpen}
        contactId={detail.contact.id}
        contactName={detail.contact.name}
        onClose={() => setMergeOpen(false)}
        onMerged={onChanged}
      />
    </div>
  );
}
