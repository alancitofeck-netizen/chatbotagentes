import type { MiniAppLeadStatus } from "@/lib/miniApps/queries";
import type { KanbanStage } from "@/components/kanban/KanbanBoard";

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

/** Etapas del kanban de Leads (Fase 2) — "Perdido" (discarded) queda afuera
 * de acá a propósito: MiniAppLeadsKanban lo agrega solo cuando el usuario
 * activa "Mostrar perdidos", así queda oculto por defecto como pide el
 * mockup sin duplicar esta lista en dos lugares. */
export const MINI_APP_LEAD_VISIBLE_STAGES: KanbanStage[] = [
  { id: "new", name: LEAD_STATUS_LABEL.new, position: 0 },
  { id: "contacted", name: LEAD_STATUS_LABEL.contacted, position: 1 },
  { id: "cita_agendada", name: LEAD_STATUS_LABEL.cita_agendada, position: 2 },
  { id: "propuesta_enviada", name: LEAD_STATUS_LABEL.propuesta_enviada, position: 3 },
  { id: "converted", name: LEAD_STATUS_LABEL.converted, position: 4, isWon: true },
];

export const MINI_APP_LEAD_DISCARDED_STAGE: KanbanStage = { id: "discarded", name: LEAD_STATUS_LABEL.discarded, position: 5, isLost: true };
