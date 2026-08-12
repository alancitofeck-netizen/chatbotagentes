import type { BadgeVariant } from "@/components/ui/Badge";
import type { ClientTask } from "@/lib/clients/queries";

/** "Vencida" no es un valor de tasks.status — es una reclasificación en
 * vivo (pending/in_progress + due_at pasado) para que tiles/donut/tabla
 * cuenten exactamente lo mismo en los cuatro baldes mutuamente excluyentes
 * que pide la referencia visual. */
export function isOverdue(task: Pick<ClientTask, "status" | "dueAt">): boolean {
  return task.status !== "completed" && !!task.dueAt && new Date(task.dueAt) < new Date();
}

export type TaskEstadoCategory = "pending" | "in_progress" | "completed" | "overdue";

/** Categoría mutuamente excluyente — la misma reclasificación que usan
 * tiles/donut, expuesta para que el filtro "Estado" de la tabla filtre por
 * exactamente lo mismo que esos números muestran. */
export function estadoCategory(task: Pick<ClientTask, "status" | "dueAt">): TaskEstadoCategory {
  if (task.status === "completed") return "completed";
  if (isOverdue(task)) return "overdue";
  return task.status === "in_progress" ? "in_progress" : "pending";
}

export function getTaskEstadoMeta(task: ClientTask): { label: string; variant: BadgeVariant } {
  if (task.status === "completed") return { label: "Completada", variant: "success" };
  if (isOverdue(task)) return { label: "Vencida", variant: "error" };
  if (task.status === "in_progress") return { label: "En progreso", variant: "accent" };
  return { label: "Pendiente", variant: "neutral" };
}

export function formatDueLabel(task: ClientTask): { text: string; tone: "success" | "warning" | "error" | "neutral" } {
  if (task.status === "completed") return { text: "Completado", tone: "success" };
  if (!task.dueAt) return { text: "Sin fecha", tone: "neutral" };
  const days = Math.round((new Date(task.dueAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"} de atraso`, tone: "error" };
  if (days === 0) return { text: "Vence hoy", tone: "warning" };
  return { text: `${days} día${days === 1 ? "" : "s"} restantes`, tone: "warning" };
}
