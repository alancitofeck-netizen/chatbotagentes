/** Client-safe — catálogo de tipos de dato importables/exportables y sus
 * diccionarios de columnas. Mismo shape que POLICY_FIELD_DICTIONARY
 * (src/lib/policies/constants.ts): {key,label,synonyms}, sin agrupar por
 * "entity" (a diferencia de src/lib/advisors/import/fieldDictionary.ts) para
 * que el detector de columnas sea genérico y reusable entre tipos. */

export const IMPORT_ENTITY_TYPES = ["contacts", "prospects", "policies", "payments", "events", "tasks"] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

export const IMPORT_ENTITY_LABEL: Record<ImportEntityType, string> = {
  contacts: "Clientes",
  prospects: "Prospectos",
  policies: "Pólizas",
  payments: "Cobros",
  events: "Eventos",
  tasks: "Tareas",
};

/** "Prospectos" no tiene un importador propio acá — ya existe uno mejor
 * (src/app/(protected)/advisors/import, corre en background, con dedupe por
 * DNI/CUIT/email/teléfono y resolución de aseguradora/ramo/producto) y
 * duplicarlo en un motor síncrono más simple sería peor, no mejor. Elegir
 * "Prospectos" acá lleva al asesor a ese importador dedicado en vez de
 * reimplementarlo. */
export const REDIRECT_ENTITY_TYPES: ImportEntityType[] = ["prospects"];

export interface FieldDescriptor {
  key: string;
  label: string;
  synonyms: string[];
  required?: boolean;
}

export const CONTACT_FIELD_DICTIONARY: FieldDescriptor[] = [
  { key: "name", label: "Nombre", synonyms: ["nombre", "nombre completo", "cliente", "name", "full name"], required: true },
  { key: "phone", label: "Teléfono / WhatsApp", synonyms: ["telefono", "teléfono", "whatsapp", "celular", "phone", "movil"] },
  { key: "email", label: "Email", synonyms: ["email", "correo", "e-mail", "mail"] },
  { key: "company", label: "Empresa", synonyms: ["empresa", "compania", "company", "organizacion"] },
  { key: "dni", label: "DNI", synonyms: ["dni", "documento", "cedula", "identificacion"] },
  { key: "cuit", label: "CUIT", synonyms: ["cuit", "cuil", "tax id", "rfc"] },
];

export const TASK_FIELD_DICTIONARY: FieldDescriptor[] = [
  { key: "title", label: "Título", synonyms: ["titulo", "título", "tarea", "task", "asunto"], required: true },
  { key: "description", label: "Descripción", synonyms: ["descripcion", "descripción", "detalle", "notas"] },
  { key: "dueDate", label: "Vencimiento", synonyms: ["vencimiento", "fecha", "due date", "fecha limite"] },
  { key: "priority", label: "Prioridad", synonyms: ["prioridad", "priority"] },
  { key: "status", label: "Estado", synonyms: ["estado", "status"] },
  { key: "assignedToName", label: "Asignado a", synonyms: ["asignado", "responsable", "assigned to", "agente"] },
];

/** Fecha y hora en columnas separadas, no una sola "fecha y hora" combinada
 * — parseExcelSheet (advisors/import/parseFile.ts, reusado acá) trunca las
 * celdas de fecha de Excel a YYYY-MM-DD sin hora (cellToString), así que un
 * campo combinado perdería la hora silenciosamente en cualquier archivo
 * .xlsx real. Separado funciona igual de bien para CSV (el usuario mapea
 * "Hora" a texto suelto) y no depende de un comportamiento del parser que
 * no vamos a tocar (lo usan también Asesores/Pólizas). */
export const EVENT_FIELD_DICTIONARY: FieldDescriptor[] = [
  { key: "subject", label: "Título", synonyms: ["titulo", "título", "asunto", "evento", "subject"], required: true },
  { key: "startDate", label: "Fecha de inicio", synonyms: ["fecha inicio", "fecha", "start date", "inicio"], required: true },
  { key: "startTime", label: "Hora de inicio", synonyms: ["hora inicio", "hora", "start time"] },
  { key: "endDate", label: "Fecha de fin", synonyms: ["fecha fin", "end date", "fin"] },
  { key: "endTime", label: "Hora de fin", synonyms: ["hora fin", "end time"] },
  { key: "location", label: "Ubicación", synonyms: ["ubicacion", "ubicación", "lugar", "location"] },
  { key: "contactName", label: "Contacto", synonyms: ["contacto", "cliente", "participante", "contact"] },
  { key: "description", label: "Descripción", synonyms: ["descripcion", "descripción", "notas", "detalle"] },
];

export const PAYMENT_FIELD_DICTIONARY: FieldDescriptor[] = [
  { key: "policyNumber", label: "N° de póliza", synonyms: ["poliza", "póliza", "numero de poliza", "policy number"], required: true },
  { key: "dueDate", label: "Vencimiento", synonyms: ["vencimiento", "fecha", "due date"], required: true },
  { key: "amount", label: "Monto", synonyms: ["monto", "importe", "amount", "valor"], required: true },
  { key: "currency", label: "Moneda", synonyms: ["moneda", "currency"] },
  { key: "status", label: "Estado", synonyms: ["estado", "status"] },
];

// Partial, no Record<Exclude<ImportEntityType,"prospects">,...> — "prospects"
// nunca llega acá (REDIRECT_ENTITY_TYPES lo intercepta antes en la UI), pero
// modelarlo como faltante-posible es más simple que forzar a cada callsite a
// descartar "prospects" del tipo de su propia variable antes de indexar.
export const FIELD_DICTIONARY_BY_ENTITY: Partial<Record<ImportEntityType, FieldDescriptor[]>> = {
  contacts: CONTACT_FIELD_DICTIONARY,
  policies: [], // reusa POLICY_FIELD_DICTIONARY (policies/constants.ts) directamente en el wizard
  payments: PAYMENT_FIELD_DICTIONARY,
  events: EVENT_FIELD_DICTIONARY,
  tasks: TASK_FIELD_DICTIONARY,
};

export const EXPORT_FORMAT_LABEL: Record<string, string> = {
  csv: "CSV",
  xlsx: "Excel",
  pdf: "PDF",
  ics: "ICS",
};
