/** Client-safe constants — mismo motivo que policies/constants.ts. */

export const CONNECTION_METHODS = ["manual", "portal", "api"] as const;
export type ConnectionMethod = (typeof CONNECTION_METHODS)[number];

export const CONNECTION_METHOD_LABEL: Record<ConnectionMethod, string> = {
  manual: "Carga manual",
  portal: "Portal Web",
  api: "API",
};

export const CONNECTION_STATUSES = ["not_connected", "connected", "error"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Estados reales de insurance_sync_jobs (0107 + 0162_portfolio_agent.sql)
 * — los primeros 3 son los que ya usaba la carga manual, el resto es el
 * progreso granular de una sincronización por portal. */
export const PORTAL_SYNC_JOB_STATUSES = [
  "processing",
  "completed",
  "failed",
  "queued",
  "starting",
  "authenticating",
  "navigating",
  "extracting",
  "normalizing",
  "syncing",
  "analyzing",
  "cancelled",
  "requires_user_action",
] as const;
export type PortalSyncJobStatus = (typeof PORTAL_SYNC_JOB_STATUSES)[number];

export const PORTAL_SYNC_STEP_LABEL: Record<PortalSyncJobStatus, string> = {
  processing: "Procesando",
  completed: "Completada",
  failed: "Falló",
  queued: "En cola",
  starting: "Iniciando",
  authenticating: "Autenticando",
  navigating: "Accediendo a la cartera",
  extracting: "Leyendo pólizas",
  normalizing: "Normalizando datos",
  syncing: "Sincronizando con el CRM",
  analyzing: "Analizando",
  cancelled: "Cancelada",
  requires_user_action: "Requiere verificación manual",
};

/** Agrupación para color/ícono en la UI — no un enum nuevo, solo cómo
 * pintar cada estado real. */
export function portalSyncJobGroup(status: PortalSyncJobStatus): "success" | "error" | "warning" | "progress" {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "cancelled" || status === "requires_user_action") return "warning";
  return "progress";
}

/** Mensajes del progreso animado al confirmar una carga manual — cada uno
 * corresponde a una fase real de confirmInsuranceSyncAction (parsear →
 * crear contactos → crear pólizas → listo), no un efecto decorativo sin
 * relación con lo que está pasando de verdad. */
export const SYNC_PROGRESS_MESSAGES = [
  "Leyendo tu cartera…",
  "Sincronizando pólizas…",
  "Creando clientes nuevos…",
  "Actualizando cobranza y renovaciones…",
  "Conexión completada",
];
