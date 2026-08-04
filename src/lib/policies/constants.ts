/**
 * Client-safe constants for the Pólizas module — deliberately split out of
 * queries.ts (which has "server-only" at its top) because a few client
 * components (PolicyTable.tsx, PoliciesActionBar.tsx, boardFilters.ts) need
 * these as real runtime values, not just types. `import type` erases
 * fully at compile time and can safely come from a server-only file (see
 * PolicyCardView.tsx/PolicyKanban.tsx, which already do this for
 * PolicyListItem) — but a genuine value import of a const from a
 * "server-only"-marked module still pulls that whole module into the
 * client bundle graph and trips Next's hard error, which is what happened
 * here (found live: /polizas 500'd, "'server-only' cannot be imported from
 * a Client Component module"). queries.ts re-exports these so every
 * existing server-side import site keeps working unchanged.
 */

export const POLICY_STAGES = [
  { key: "cotizacion", name: "Cotización" },
  { key: "documentacion", name: "Documentación" },
  { key: "pendiente_emision", name: "Pendiente de emisión" },
  { key: "emitida", name: "Emitida" },
  { key: "activa", name: "Activa" },
  { key: "renovacion_proxima", name: "Renovación próxima" },
  { key: "renovacion_enviada", name: "Renovación enviada" },
  { key: "renovada", name: "Renovada" },
  { key: "vencida", name: "Vencida" },
  { key: "cancelada", name: "Cancelada" },
] as const;

export type PolicyStatus = (typeof POLICY_STAGES)[number]["key"];
export type InsuranceType = "auto" | "hogar" | "vida" | "otro";

/** Colapsa los 10 stages internos (más granulares que lo que se pidió) a
 * los 5 colores de badge pedidos — puramente de presentación, no toca el
 * CHECK constraint de `policies.status`. Compartido entre PolicyTable.tsx y
 * PolicyCardView.tsx para que la Tabla y el Kanban nunca muestren colores
 * distintos para el mismo estado. */
export const POLICY_STATUS_BADGE_VARIANT: Record<PolicyStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  cotizacion: "neutral",
  documentacion: "neutral",
  pendiente_emision: "neutral",
  emitida: "info",
  activa: "success",
  renovacion_proxima: "warning",
  renovacion_enviada: "warning",
  renovada: "success",
  vencida: "error",
  cancelada: "neutral",
};

export const ACTIVE_LIKE_STATUSES: PolicyStatus[] = ["emitida", "activa", "renovacion_proxima", "renovacion_enviada", "renovada"];
