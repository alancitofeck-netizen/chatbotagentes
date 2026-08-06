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
