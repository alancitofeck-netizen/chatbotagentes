"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Star, Trash2, MessageCircle } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { tabItemClassName } from "@/components/ui/Tabs";
import { toast } from "@/components/toast/toast";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { OpportunityOption } from "@/lib/crm/queries";
import type { TaskDetail, TaskOption, TaskPriority, TaskStatus } from "@/lib/tasks/queries";
import {
  deleteTask,
  getWorkspaceTagsAction,
  toggleTaskFavorite,
  toggleTaskTag,
  updateTask,
  updateTaskTitle,
  type TaskInput,
} from "@/lib/tasks/actions";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";
import { ResumenTab } from "./tabs/ResumenTab";
import { ComentariosTab } from "./tabs/ComentariosTab";
import { ArchivosTab } from "./tabs/ArchivosTab";
import { ActividadTab } from "./tabs/ActividadTab";

/** Detecta un link wa.me ya armado dentro de la descripción de la tarea —
 * mismo patrón que ya usa el cron de renovación de pólizas (texto plano con
 * el link embebido, ver policy-automations/route.ts) y ahora también el
 * cron de seguimientos de referidos (referral-followups/route.ts). Genérico
 * a propósito: cualquier tarea futura que embeba un link así en su
 * descripción obtiene el botón real gratis, sin acoplar esto a un
 * `related_type` puntual. */
const WA_LINK_PATTERN = /https:\/\/wa\.me\/\S+/;

function extractWaLink(description: string | null): string | null {
  if (!description) return null;
  return description.match(WA_LINK_PATTERN)?.[0] ?? null;
}

type TabKey = "resumen" | "comentarios" | "archivos" | "actividad";
const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "comentarios", label: "Comentarios" },
  { key: "archivos", label: "Archivos" },
  { key: "actividad", label: "Actividad" },
];

/** Full-page task detail — same route+tabs-by-URL convention already used by
 * mini-apps/[miniAppId] and ai-agents/[agentId] (a real navigable route per
 * tab, not in-page-only state). */
export function TaskDetailShell({
  initialTask,
  workspaceId,
  members,
  contactOptions,
  conversationOptions,
  opportunityOptions,
  advisorPolicyOptions,
  eventOptions,
  documentOptions,
  canAssignOthers,
  ownMemberId,
}: {
  initialTask: TaskDetail;
  workspaceId: string;
  members: WorkspaceMemberOption[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  opportunityOptions: OpportunityOption[];
  advisorPolicyOptions: TaskOption[];
  eventOptions: TaskOption[];
  documentOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: TabKey = (TABS.some((t) => t.key === requestedTab) ? requestedTab : "resumen") as TabKey;

  const [task, setTask] = useState(initialTask);
  const [titleDraft, setTitleDraft] = useState(initialTask.title);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getWorkspaceTagsAction().then(setTags);
  }, []);

  function currentInput(): TaskInput & { status: TaskStatus } {
    return {
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt,
      assignedTo: task.assignedTo?.memberId ?? "",
      relatedType: task.relatedType,
      relatedId: task.relatedId,
    };
  }

  async function updateField(patch: Partial<TaskInput & { status: TaskStatus }>) {
    const merged = { ...currentInput(), ...patch };
    try {
      await updateTask(task.id, merged);
      setTask((prev) => ({
        ...prev,
        title: merged.title,
        priority: merged.priority,
        status: merged.status,
        dueAt: merged.dueAt,
        completedAt: merged.status === "completed" ? new Date().toISOString() : null,
        assignedTo: merged.assignedTo
          ? (() => {
              const m = members.find((mm) => mm.memberId === merged.assignedTo);
              return m ? { memberId: m.memberId, fullName: m.fullName, avatarUrl: m.avatarUrl } : prev.assignedTo;
            })()
          : null,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
    }
  }

  async function handleTitleBlur() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === task.title) {
      setTitleDraft(task.title);
      return;
    }
    await updateTaskTitle(task.id, trimmed);
    setTask((prev) => ({ ...prev, title: trimmed }));
  }

  async function handleToggleFavorite() {
    const next = !task.isFavorite;
    setTask((prev) => ({ ...prev, isFavorite: next }));
    await toggleTaskFavorite(task.id, next);
  }

  async function handleToggleTag(tagId: string, on: boolean) {
    setTask((prev) => ({
      ...prev,
      tags: on ? [...prev.tags, tags.find((t) => t.id === tagId)!] : prev.tags.filter((t) => t.id !== tagId),
    }));
    await toggleTaskTag(task.id, tagId, on);
  }

  async function handleDelete() {
    if (!window.confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      toast.success("Tarea eliminada.");
      router.push("/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la tarea.");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/tasks?view=list" className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-foreground">
          <ArrowLeft size={15} aria-hidden="true" />
          Volver a Tareas
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={task.isFavorite ? "Quitar de favoritos" : "Marcar como favorita"}
            className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-warning-strong"
          >
            <Star size={17} className={task.isFavorite ? "fill-warning-strong text-warning-strong" : ""} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Eliminar tarea"
            className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong disabled:opacity-40"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <input
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full border-none bg-transparent text-[24px] font-semibold tracking-[-0.02em] text-foreground outline-none focus:ring-0"
        aria-label="Título de la tarea"
      />

      {extractWaLink(task.description) && (
        <LinkButton href={extractWaLink(task.description)!} target="_blank" rel="noopener noreferrer" variant="secondary" className="w-fit bg-success-strong text-white hover:opacity-90">
          <MessageCircle className="size-4" aria-hidden="true" />
          Abrir WhatsApp
        </LinkButton>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Estado"
          value={task.status}
          onChange={(e) => updateField({ status: e.target.value as TaskStatus })}
          containerClassName="w-40"
        >
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select
          label="Prioridad"
          value={task.priority}
          onChange={(e) => updateField({ priority: e.target.value as TaskPriority })}
          containerClassName="w-40"
        >
          {Object.entries(PRIORITY_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        {canAssignOthers ? (
          <Select
            label="Responsable"
            value={task.assignedTo?.memberId ?? ""}
            onChange={(e) => updateField({ assignedTo: e.target.value })}
            containerClassName="w-48"
          >
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.memberId === ownMemberId ? `${m.fullName} (vos)` : m.fullName}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Responsable</span>
            <span className="rounded-sm border border-border-strong bg-surface-2 px-3 py-2 text-sm text-neutral-500">
              {task.assignedTo?.fullName ?? "Sin asignar"}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="task-due-date">
            Fecha límite
          </label>
          <input
            id="task-due-date"
            type="date"
            value={task.dueAt ? task.dueAt.slice(0, 10) : ""}
            onChange={(e) => updateField({ dueAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const active = task.tags.some((tt) => tt.id === t.id);
            return (
              <button key={t.id} type="button" onClick={() => handleToggleTag(t.id, !active)}>
                <Badge variant={active ? tagBadgeVariant(t.color) : "neutral"} className={active ? "" : "opacity-60"}>
                  {t.name}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      <div role="tablist" className="flex gap-5 border-b border-border-default">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/tasks/${task.id}?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={tabItemClassName(tab === t.key, false)}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div>
        {tab === "resumen" && (
          <ResumenTab
            task={task}
            onTaskChange={setTask}
            contactOptions={contactOptions}
            conversationOptions={conversationOptions}
            opportunityOptions={opportunityOptions}
            advisorPolicyOptions={advisorPolicyOptions}
            eventOptions={eventOptions}
            documentOptions={documentOptions}
          />
        )}
        {tab === "comentarios" && <ComentariosTab taskId={task.id} />}
        {tab === "archivos" && <ArchivosTab taskId={task.id} workspaceId={workspaceId} />}
        {tab === "actividad" && <ActividadTab taskId={task.id} />}
      </div>
    </div>
  );
}
