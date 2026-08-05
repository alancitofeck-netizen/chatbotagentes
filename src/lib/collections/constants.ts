/** Client-safe constants — mismo motivo que policies/constants.ts. */

export const COLLECTION_STATUSES = ["pendiente", "en_seguimiento", "pagado", "cancelado"] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

/** Bucket "de vista" — lo que realmente se muestra como badge/columna de
 * Kanban. "vencido"/"proximo" NUNCA se persisten: se derivan de due_date en
 * cada lectura, así que no hace falta un cron que los mantenga sincronizados
 * (mismo criterio ya usado en el tab Pagos de Pólizas). */
export type CollectionBucket = "pagado" | "cancelado" | "vencido" | "proximo" | "en_seguimiento" | "pendiente";

const UPCOMING_DAYS = 7;

export function deriveCollectionBucket(status: CollectionStatus, dueDate: string): CollectionBucket {
  if (status === "pagado") return "pagado";
  if (status === "cancelado") return "cancelado";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "vencido";
  if (diffDays <= UPCOMING_DAYS) return "proximo";
  if (status === "en_seguimiento") return "en_seguimiento";
  return "pendiente";
}

export const COLLECTION_BUCKET_LABEL: Record<CollectionBucket, string> = {
  pagado: "Pagado",
  cancelado: "Cancelado",
  vencido: "Vencido",
  proximo: "Próximo a vencer",
  en_seguimiento: "En seguimiento",
  pendiente: "Programado",
};

export const COLLECTION_BUCKET_VARIANT: Record<CollectionBucket, "success" | "error" | "warning" | "info" | "neutral"> = {
  pagado: "success",
  cancelado: "neutral",
  vencido: "error",
  proximo: "warning",
  en_seguimiento: "info",
  pendiente: "info",
};

/** Columnas del Kanban, en orden — "vencido"/"proximo" están pero no son
 * destino válido de un drag (se llega ahí solo por fecha, nunca a mano). */
export const COLLECTION_KANBAN_COLUMNS: { key: CollectionBucket; label: string; droppable: boolean }[] = [
  { key: "pendiente", label: "Pendiente", droppable: true },
  { key: "en_seguimiento", label: "En seguimiento", droppable: true },
  { key: "proximo", label: "Próximo", droppable: false },
  { key: "vencido", label: "Vencido", droppable: false },
  { key: "pagado", label: "Pagado", droppable: true },
];

export const PAYMENT_METHODS = ["Transferencia", "Tarjeta", "Efectivo", "Domiciliación", "Cheque", "Otro"];
