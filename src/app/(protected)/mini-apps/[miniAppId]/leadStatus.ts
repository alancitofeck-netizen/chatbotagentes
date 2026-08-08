import type { MiniAppLeadStatus } from "@/lib/miniApps/queries";

/** Compartido entre MiniAppLeadCard.tsx y LeadHeader.tsx — un solo lugar
 * para no divergir la etiqueta/color de estado de un lead. */
export const LEAD_STATUS_LABEL: Record<MiniAppLeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  converted: "Convertido",
  discarded: "Descartado",
};

export const LEAD_STATUS_VARIANT: Record<MiniAppLeadStatus, "neutral" | "accent" | "success" | "warning"> = {
  new: "accent",
  contacted: "warning",
  converted: "success",
  discarded: "neutral",
};
