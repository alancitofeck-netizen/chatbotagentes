import type { CollectionItem } from "@/lib/collections/queries";
import { deriveCollectionBucket, type CollectionBucket } from "@/lib/collections/constants";

/** Priorización y riesgo 100% determinísticos — sin IA, sin puntaje/
 * probabilidad "de pago" fabricada (decisión explícita del módulo, ver
 * CollectionAiPanel.tsx). Todo acá sale de datos reales del propio cobro:
 * cuántos días de mora/anticipación tiene y cuánta plata hay en juego. */

function daysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Peso de urgencia por bucket — no una probabilidad, solo un multiplicador
 * para ordenar. Vencido siempre pesa más que no vencido, y dentro de
 * "vencido" cuantos más días de mora, más arriba en la lista. */
function urgencyWeight(bucket: CollectionBucket, dueDate: string): number {
  const diff = daysUntilDue(dueDate);
  switch (bucket) {
    case "vencido":
      return 10 + Math.min(Math.abs(diff), 365);
    case "proximo":
      return 2 + Math.max(0, 7 - diff) / 7;
    case "en_seguimiento":
      return 1.5;
    case "pendiente":
      return 0.5;
    case "pagado":
    case "cancelado":
      return 0;
  }
}

/** amount × peso de urgencia — un cobro vencido de $100.000 siempre va a
 * priorizarse por encima de uno próximo de $10.000, y entre dos vencidos
 * gana el que tenga más días de mora. Determinístico y explicable, no una
 * predicción. */
export function computeCollectionPriorityScore(item: CollectionItem): number {
  const bucket = deriveCollectionBucket(item.status, item.dueDate);
  return Math.round(item.amount * urgencyWeight(bucket, item.dueDate));
}

export interface RiskFlag {
  level: "info" | "warning" | "error";
  label: string;
}

/** Señales cualitativas basadas en datos reales — nunca un score inventado.
 * `avgAmount` (opcional) es el promedio de la cartera, para poder marcar
 * "monto alto" en términos relativos en vez de un umbral fijo arbitrario. */
export function getCollectionRiskFlags(item: CollectionItem, avgAmount?: number): RiskFlag[] {
  const bucket = deriveCollectionBucket(item.status, item.dueDate);
  const flags: RiskFlag[] = [];
  const diff = daysUntilDue(item.dueDate);

  if (bucket === "vencido") {
    const overdueDays = Math.abs(diff);
    if (overdueDays > 30) flags.push({ level: "error", label: `Mora de más de 30 días (${overdueDays} días vencido)` });
    else if (overdueDays > 7) flags.push({ level: "warning", label: `En mora hace ${overdueDays} días` });
    else flags.push({ level: "warning", label: `Venció hace ${overdueDays} día${overdueDays === 1 ? "" : "s"}` });
  } else if (bucket === "proximo" && item.status === "pendiente") {
    flags.push({ level: "info", label: `Vence en ${diff} día${diff === 1 ? "" : "s"} — sin seguimiento iniciado` });
  }

  if (bucket !== "pagado" && bucket !== "cancelado" && !item.contactPhone && !item.contactEmail) {
    flags.push({ level: "warning", label: "Sin teléfono ni email — no se le puede avisar automáticamente" });
  }

  if (avgAmount && avgAmount > 0 && item.amount > avgAmount * 2 && bucket !== "pagado" && bucket !== "cancelado") {
    flags.push({ level: "info", label: "Monto muy por encima del promedio de la cartera" });
  }

  return flags;
}

export interface RankedCollectionItem extends CollectionItem {
  priorityScore: number;
  riskFlags: RiskFlag[];
}

/** Ranking completo de la cartera para el panel de IA — ordenado por
 * priorityScore descendente, solo cobros abiertos (no pagados/cancelados). */
export function rankCollectionsByPriority(items: CollectionItem[]): RankedCollectionItem[] {
  const open = items.filter((i) => i.status !== "pagado" && i.status !== "cancelado");
  const avgAmount = open.length ? open.reduce((s, i) => s + i.amount, 0) / open.length : 0;

  return open
    .map((item) => ({ ...item, priorityScore: computeCollectionPriorityScore(item), riskFlags: getCollectionRiskFlags(item, avgAmount) }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
