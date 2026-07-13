// Pure types/constants shared between the client (DocumentsShell's export
// menu) and the server-only exports.ts — kept in a separate file with no
// "server-only" imports so the client bundle doesn't try to pull in
// contacts/tasks/calendar/etc. query modules (each of which is itself
// server-only) just to read a label string.
export type ExportEntity = "contacts" | "companies" | "conversations" | "tasks" | "calendar" | "agents" | "reports";
export type ExportFormat = "csv" | "xlsx" | "pdf";

export const ENTITY_LABELS: Record<ExportEntity, string> = {
  contacts: "Contactos",
  companies: "Empresas",
  conversations: "Conversaciones",
  tasks: "Tareas",
  calendar: "Calendario",
  agents: "Agentes",
  reports: "Reportes",
};
