import type { MiniAppLeadStatus } from "@/lib/miniApps/queries";

/** Compartido entre varios componentes del detalle de una Mini App — un solo lugar
 * para no divergir la etiqueta/color de estado de un lead. */
export const LEAD_STATUS_LABEL: Record<MiniAppLeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  cita_agendada: "Cita agendada",
  propuesta_enviada: "Propuesta enviada",
  converted: "Convertido",
  discarded: "Descartado",
};

export const LEAD_STATUS_VARIANT: Record<MiniAppLeadStatus, "neutral" | "accent" | "success" | "warning"> = {
  new: "accent",
  contacted: "warning",
  cita_agendada: "warning",
  propuesta_enviada: "warning",
  converted: "success",
  discarded: "neutral",
};
