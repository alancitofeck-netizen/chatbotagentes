import type { AsesoriaStatus } from "@/lib/asesorias/queries";
import type { BadgeVariant } from "@/components/ui/Badge";

export type OperacionPeriod = "7d" | "30d" | "month" | "year" | "all";

export const PERIOD_OPTIONS: { key: OperacionPeriod; label: string }[] = [
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "month", label: "Este mes" },
  { key: "year", label: "Este año" },
  { key: "all", label: "Todo el tiempo" },
];

/** Fecha de corte para un período — null significa "sin corte" (Todo el
 * tiempo). Se aplica en memoria sobre los arrays ya cargados por el server
 * component (mismo criterio que ya usan los StatTiles actuales de esta
 * ficha vía monthOverMonthDelta/statsHelpers.ts). */
export function periodStartDate(period: OperacionPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

export function withinPeriod(iso: string, period: OperacionPeriod): boolean {
  const cutoff = periodStartDate(period);
  if (!cutoff) return true;
  return new Date(iso) >= cutoff;
}

export const ASESORIA_STATUS_LABEL: Record<AsesoriaStatus, string> = {
  no_iniciada: "No iniciada",
  en_progreso: "En progreso",
  finalizada: "Finalizada",
};

export const ASESORIA_STATUS_VARIANT: Record<AsesoriaStatus, BadgeVariant> = {
  no_iniciada: "neutral",
  en_progreso: "warning",
  finalizada: "success",
};

/** "1 min"/"5 min" del mockup — no hay columna de duración en `asesorias`,
 * se estima como completedAt (o updatedAt si sigue en progreso) menos
 * startedAt. "—" si el resultado no es un número sensato (ej. datos
 * inconsistentes de una sesión nunca cerrada correctamente). */
export function formatAsesoriaDuration(startedAt: string, completedAt: string | null, updatedAt: string): string {
  const end = completedAt ?? updatedAt;
  const minutes = Math.round((new Date(end).getTime() - new Date(startedAt).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes === 0) return "< 1 min";
  return `${minutes} min`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** CSV client-side (sin round-trip al server) de las filas ya visibles del
 * sub-tab activo — Blob + URL.createObjectURL, mismo criterio de "no
 * duplicar datos" que el resto del rediseño: exporta exactamente lo que ya
 * está en memoria, nunca vuelve a pedirle nada al servidor. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
