import type { BadgeVariant } from "@/components/ui/Badge";
import type { EstadoCita } from "./queries";

/** Compartido por la card de Agenda y la vista de KPIs → Agendas. */
export const ESTADO_CITA_META: Record<EstadoCita, { label: string; variant: BadgeVariant }> = {
  agendada: { label: "Agendada", variant: "warning" },
  confirmada: { label: "Confirmada", variant: "info" },
  realizada: { label: "Realizada", variant: "success" },
  no_show: { label: "No Show", variant: "error" },
  cancelada: { label: "Cancelada", variant: "neutral" },
  venta: { label: "Venta", variant: "accent" },
};

export const ESTADO_CITA_OPTIONS: EstadoCita[] = ["agendada", "confirmada", "realizada", "no_show", "cancelada", "venta"];
