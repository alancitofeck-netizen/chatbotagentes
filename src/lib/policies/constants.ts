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

/** Categorías de archivos para el tab Documentos del detalle de póliza —
 * usa la columna genérica documents.doc_category (0095), sin CHECK, así que
 * esta lista es solo la convención de app-code para este módulo. */
export const POLICY_DOCUMENT_CATEGORIES = [
  { key: "poliza_pdf", label: "PDF de póliza" },
  { key: "endoso", label: "Endoso" },
  { key: "recibo", label: "Recibo" },
  { key: "condiciones_generales", label: "Condiciones generales" },
  { key: "otro", label: "Otro" },
] as const;

export type PolicyDocumentCategory = (typeof POLICY_DOCUMENT_CATEGORIES)[number]["key"];

/** Diccionario de campos del importador de Excel/CSV — vive acá (no en
 * import.ts, que es "server-only") porque PolicyImportSheet.tsx (Client
 * Component) necesita los labels para poblar el <select> de mapeo de
 * columnas. import.ts's detectPolicyColumnMapping importa este mismo array. */
export interface PolicyImportFieldDescriptor {
  key: string;
  label: string;
  synonyms: string[];
}

export const POLICY_FIELD_DICTIONARY: PolicyImportFieldDescriptor[] = [
  { key: "contactName", label: "Cliente", synonyms: ["nombre", "cliente", "nombre cliente", "nombre del cliente", "name", "contratante"] },
  { key: "contactPhone", label: "Teléfono", synonyms: ["telefono", "celular", "phone", "whatsapp", "movil"] },
  { key: "contactEmail", label: "Email", synonyms: ["email", "correo", "correo electronico", "mail"] },
  { key: "policyNumber", label: "N° de póliza", synonyms: ["numero de poliza", "n poliza", "nro poliza", "policy number", "poliza", "numero"] },
  { key: "company", label: "Aseguradora", synonyms: ["aseguradora", "compania", "company", "insurer", "compania de seguros"] },
  { key: "product", label: "Producto", synonyms: ["producto", "product", "ramo"] },
  { key: "insuranceType", label: "Tipo", synonyms: ["tipo", "tipo de poliza", "ramo tipo", "type"] },
  { key: "startDate", label: "Inicio de vigencia", synonyms: ["fecha inicio", "inicio vigencia", "start date", "vigencia desde"] },
  { key: "endDate", label: "Vencimiento", synonyms: ["fecha vencimiento", "vencimiento", "expiration date", "expiry"] },
  { key: "premium", label: "Prima", synonyms: ["prima", "premium", "prima neta"] },
  { key: "premiumCurrency", label: "Moneda", synonyms: ["moneda", "currency"] },
  { key: "paymentFrequency", label: "Frecuencia de pago", synonyms: ["frecuencia", "frecuencia de pago", "payment frequency", "forma de pago"] },
  { key: "commissionAmount", label: "Comisión", synonyms: ["comision", "commission"] },
  { key: "ownerName", label: "Ejecutivo/Asesor", synonyms: ["ejecutivo", "asesor", "agente", "advisor", "productor"] },
];
