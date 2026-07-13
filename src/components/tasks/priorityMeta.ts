import type { BadgeVariant } from "@/components/ui/Badge";
import type { TaskPriority, TaskStatus } from "@/lib/tasks/queries";

export const PRIORITY_META: Record<TaskPriority, { label: string; badgeVariant: BadgeVariant }> = {
  low: { label: "Baja", badgeVariant: "neutral" },
  medium: { label: "Media", badgeVariant: "accent" },
  high: { label: "Alta", badgeVariant: "warning" },
  urgent: { label: "Urgente", badgeVariant: "error" },
};

export const STATUS_META: Record<TaskStatus, { label: string; badgeVariant: BadgeVariant }> = {
  pending: { label: "Pendiente", badgeVariant: "neutral" },
  in_progress: { label: "En progreso", badgeVariant: "accent" },
  completed: { label: "Completada", badgeVariant: "success" },
};
