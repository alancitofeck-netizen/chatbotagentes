"use client";

import { Briefcase, CheckSquare, Clock, MessageCircle, MessageSquare, Paperclip, ShieldCheck, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { formatRelativeTime } from "@/lib/utils/format";
import type { TaskItem, TaskRelatedType } from "@/lib/tasks/queries";
import { PRIORITY_META, STATUS_META } from "./priorityMeta";

const RELATED_ICON: Record<TaskRelatedType, LucideIcon> = {
  contact: User,
  conversation: MessageCircle,
  opportunity: Briefcase,
};

/** Rich task card (Sección 1 del rediseño) — reused by the Lista/Kanban
 * views. Every count (subtareas/comentarios/archivos) comes pre-batched
 * from getTasks (src/lib/tasks/queries.ts's resolveTaskCounts) — no
 * per-card query here. */
export function TaskCard({
  task,
  onOpen,
  onToggleComplete,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  task: TaskItem;
  onOpen: () => void;
  onToggleComplete?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const isOverdue = Boolean(task.dueAt) && task.status !== "completed" && new Date(task.dueAt as string) < new Date();
  const RelatedIcon = task.relatedType ? RELATED_ICON[task.relatedType] : null;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-xs)] transition-colors",
        selected && "ring-2 ring-accent-500",
      )}
    >
      <div className="flex items-start gap-2.5">
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--color-accent-500)]"
          />
        ) : (
          <input
            type="checkbox"
            checked={task.status === "completed"}
            onChange={onToggleComplete}
            disabled={task.status === "completed" || !onToggleComplete}
            className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--color-accent-500)]"
            aria-label="Marcar como completada"
          />
        )}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className={cn("text-[14px] font-medium text-foreground", task.status === "completed" && "text-neutral-400 line-through")}>
            {task.title}
          </p>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-6">
        <Badge variant={STATUS_META[task.status].badgeVariant}>{STATUS_META[task.status].label}</Badge>
        <Badge variant={PRIORITY_META[task.priority].badgeVariant}>{PRIORITY_META[task.priority].label}</Badge>
        {task.tags.map((tag) => (
          <Badge key={tag.id} variant="neutral">
            {tag.name}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-[12px] text-neutral-500">
        {task.dueAt && (
          <span className={cn("inline-flex items-center gap-1", isOverdue && "font-medium text-error-strong")}>
            <Clock className="size-3.5" aria-hidden="true" />
            {formatRelativeTime(task.dueAt)}
          </span>
        )}
        {task.assignedTo && (
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={task.assignedTo.fullName} src={task.assignedTo.avatarUrl} size={18} />
            {task.assignedTo.fullName}
          </span>
        )}
        {RelatedIcon && task.relatedLabel && (
          <span className="inline-flex items-center gap-1">
            <RelatedIcon className="size-3.5" aria-hidden="true" />
            {task.relatedLabel}
          </span>
        )}
        {task.checklistTotal > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3.5" aria-hidden="true" />
            {task.checklistDone}/{task.checklistTotal}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden="true" />
            {task.commentCount}
          </span>
        )}
        {task.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3.5" aria-hidden="true" />
            {task.attachmentCount}
          </span>
        )}
        <span className="ml-auto text-neutral-400">{formatRelativeTime(task.updatedAt)}</span>
      </div>
    </div>
  );
}

/** advisor_policy relation icon isn't in RELATED_ICON above because the
 * legacy tasks.related_type column only ever holds contact/conversation/
 * opportunity — kept for a future relations-badge row on this same card
 * if the multi-relation panel's chips end up mirrored here too. */
export const RELATION_TYPE_ICON: Record<string, LucideIcon> = {
  contact: User,
  conversation: MessageCircle,
  opportunity: Briefcase,
  advisor_policy: ShieldCheck,
};
