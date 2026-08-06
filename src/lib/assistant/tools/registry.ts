import type { OpenRouterToolDef } from "@/lib/integrations/openrouter";
import type { AssistantToolHandler } from "@/lib/assistant/tools/shared";
import { searchContact, getTodaySummary, queryKpis, listUpcomingMeetings, listOverdueCollections, listExpiringPolicies, summarizeContact } from "@/lib/assistant/tools/readTools";
import { createTask, movePipelineItem, createMeeting, registerPayment, createPolicyQuote, draftMessageReply } from "@/lib/assistant/tools/writeTools";

export interface AssistantToolDef {
  key: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: AssistantToolHandler;
  /** true = nunca se ejecuta directo desde el turno del modelo, queda
   * "proposed" hasta que el usuario confirma (ver runtime.ts). */
  requiresConfirmation: boolean;
}

/** Catálogo fijo del Asistente IA — a diferencia del motor de Agentes IA de
 * WhatsApp (tabla `tools`, configurable por el Owner por prompt), acá hay
 * un solo asistente con un set de herramientas fijo en código. Curado
 * deliberadamente (no "cualquier acción del CRM"): cada handler es
 * concreto y auditable, se suman más con el tiempo siguiendo el mismo
 * patrón. */
export const ASSISTANT_TOOLS: AssistantToolDef[] = [
  {
    key: "search_contact",
    description: "Busca un contacto por nombre o teléfono.",
    parameters: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" } } },
    handler: searchContact,
    requiresConfirmation: false,
  },
  {
    key: "get_today_summary",
    description: "Reuniones de hoy, tareas pendientes y cobros vencidos del usuario.",
    parameters: { type: "object", properties: {} },
    handler: getTodaySummary,
    requiresConfirmation: false,
  },
  {
    key: "query_kpis",
    description: "KPIs de pólizas y comisiones: prima mensual/anual, pólizas activas, renovaciones próximas, comisión cobrada/pendiente.",
    parameters: { type: "object", properties: {} },
    handler: queryKpis,
    requiresConfirmation: false,
  },
  {
    key: "list_upcoming_meetings",
    description: "Próximas reuniones del usuario en el calendario.",
    parameters: { type: "object", properties: { days: { type: "number", description: "Horizonte en días, por defecto 7." } } },
    handler: listUpcomingMeetings,
    requiresConfirmation: false,
  },
  {
    key: "list_overdue_collections",
    description: "Cobros vencidos, priorizados por monto y días de mora.",
    parameters: { type: "object", properties: {} },
    handler: listOverdueCollections,
    requiresConfirmation: false,
  },
  {
    key: "list_expiring_policies",
    description: "Pólizas que vencen pronto.",
    parameters: { type: "object", properties: { days: { type: "number", description: "Horizonte en días, por defecto 30." } } },
    handler: listExpiringPolicies,
    requiresConfirmation: false,
  },
  {
    key: "summarize_contact",
    description: "Resumen de un contacto: sus pólizas y notas recientes — útil para preparar una reunión.",
    parameters: { type: "object", properties: { contact_id: { type: "string" } }, required: ["contact_id"] },
    handler: summarizeContact,
    requiresConfirmation: false,
  },
  {
    key: "create_task",
    description: "Crea una tarea asignada al usuario.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" }, due_at: { type: "string", description: "ISO 8601, opcional" } },
      required: ["title"],
    },
    handler: createTask,
    requiresConfirmation: true,
  },
  {
    key: "move_pipeline_item",
    description: "Mueve la oportunidad de un contacto a otra etapa del pipeline de CRM/Prospectos.",
    parameters: { type: "object", properties: { contact_name: { type: "string" }, stage_name: { type: "string" } }, required: ["contact_name", "stage_name"] },
    handler: movePipelineItem,
    requiresConfirmation: true,
  },
  {
    key: "create_meeting",
    description: "Crea una reunión en el calendario, opcionalmente con un contacto.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string" },
        start_time: { type: "string", description: "ISO 8601" },
        end_time: { type: "string", description: "ISO 8601" },
        contact_name: { type: "string" },
      },
      required: ["subject", "start_time", "end_time"],
    },
    handler: createMeeting,
    requiresConfirmation: true,
  },
  {
    key: "register_payment",
    description: "Registra como pagado el próximo cobro pendiente de un contacto (cerrar una venta/cobro).",
    parameters: { type: "object", properties: { contact_name: { type: "string" } }, required: ["contact_name"] },
    handler: registerPayment,
    requiresConfirmation: true,
  },
  {
    key: "create_policy_quote",
    description: "Crea una póliza nueva en estado Cotización para un contacto.",
    parameters: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        company: { type: "string", description: "Aseguradora" },
        insurance_type: { type: "string", enum: ["auto", "hogar", "vida", "otro"] },
        premium: { type: "number" },
      },
      required: ["contact_name", "company"],
    },
    handler: createPolicyQuote,
    requiresConfirmation: true,
  },
  {
    key: "draft_message_reply",
    description: "Redacta una respuesta para un contacto y la deja como borrador en el Inbox — NUNCA la envía, el usuario la manda con un clic.",
    parameters: { type: "object", properties: { contact_name: { type: "string" }, message: { type: "string" } }, required: ["contact_name", "message"] },
    handler: draftMessageReply,
    requiresConfirmation: true,
  },
];

export const ASSISTANT_TOOL_BY_KEY = new Map(ASSISTANT_TOOLS.map((t) => [t.key, t]));

export function assistantToolDefsForModel(): OpenRouterToolDef[] {
  return ASSISTANT_TOOLS.map((t) => ({ type: "function" as const, function: { name: t.key, description: t.description, parameters: t.parameters } }));
}
