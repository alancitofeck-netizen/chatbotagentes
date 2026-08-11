import type { ClientHealthLabel } from "@/lib/clients/queries";

/** Único lugar con el mapeo de color/etiqueta del Health Score — usado por
 * el header del perfil (layout.tsx) y por ClientCard/ClientListRow del
 * dashboard, para que los 3 lugares donde se muestra siempre coincidan. */
export const HEALTH_LABEL_META: Record<ClientHealthLabel, { label: string; className: string; dot: string }> = {
  green: { label: "Saludable", className: "bg-success-strong/15 text-success-strong", dot: "bg-success-strong" },
  yellow: { label: "En atención", className: "bg-warning-bg text-warning-strong", dot: "bg-warning-strong" },
  red: { label: "En riesgo", className: "bg-error-bg text-error-strong", dot: "bg-error-strong" },
};
