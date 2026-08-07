/** Client-safe — catálogo fijo de automatizaciones (no hay constructor tipo
 * Zapier: son 10 automatizaciones concretas, prender/apagar + mensaje).
 *
 * `hasTrigger` marca honestamente cuáles ya tienen un disparador real
 * conectado (ver src/app/api/cron/run-automations/route.ts) vs. cuáles
 * guardan su configuración pero todavía no envían nada solas — no hay forma
 * honesta de mostrarlas como "activas de verdad" sin ese dato:
 * - policy_anniversary / collection_reminder / welcome: cron real (ver
 *   run-automations/route.ts) que crea una tarea con el mensaje + link de
 *   WhatsApp ya armado para el asesor (nunca auto-envía: WhatsApp Business
 *   exige plantilla aprobada por Meta fuera de la ventana de 24hs, que este
 *   proyecto no tiene — mismo criterio ya usado en Pólizas/Cobranza).
 * - policy_renewal: no es un motor nuevo — su switch prende/apaga
 *   suggest_whatsapp en las policy_automation_rules ya existentes (Pólizas),
 *   para no duplicar ese motor con uno segundo que podría disparar una
 *   tarea repetida para la misma póliza.
 * - birthday: contacts.birth_date existe (0108) pero no hay UI todavía para
 *   cargarlo, así que no hay datos reales para disparar. appointment_*:
 *   depende de si el evento de Calendario ya genera un link de Meet, sin
 *   confirmar. post_sale_followup/document_request/review_request: no
 *   tienen un criterio de disparo definido (qué es "faltante", qué es
 *   "finalizado"). Los cuatro quedan guardados, sin disparador, hasta un
 *   pedido futuro que los conecte.
 */

export const AUTOMATION_TYPES = [
  "birthday",
  "policy_anniversary",
  "collection_reminder",
  "appointment_confirmation",
  "appointment_reminder",
  "welcome",
  "post_sale_followup",
  "document_request",
  "policy_renewal",
  "review_request",
] as const;
export type AutomationType = (typeof AUTOMATION_TYPES)[number];

export interface AutomationCatalogEntry {
  type: AutomationType;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  defaultMessageTemplate: string;
  hasTrigger: boolean;
}

export const AUTOMATION_CATALOG: AutomationCatalogEntry[] = [
  {
    type: "birthday",
    name: "Cumpleaños",
    description: "Envía automáticamente un mensaje de cumpleaños por WhatsApp.",
    icon: "Cake",
    defaultEnabled: true,
    defaultMessageTemplate: "¡Feliz cumpleaños, {{nombre}}! 🎉 Todo el equipo te desea un día increíble. Gracias por confiar en nosotros.",
    hasTrigger: false,
  },
  {
    type: "policy_anniversary",
    name: "Aniversario de póliza",
    description: "Felicita al cliente cuando cumple un año con su póliza.",
    icon: "CalendarHeart",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, ¡hoy se cumple un año desde que confiaste en nosotros! Gracias por seguir eligiéndonos. 🎉",
    hasTrigger: true,
  },
  {
    type: "collection_reminder",
    name: "Recordatorio de cobranza",
    description: "Envía un recordatorio antes del vencimiento del pago.",
    icon: "Wallet",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, te recordamos que tu próximo pago vence pronto. Cualquier duda, escribinos.",
    hasTrigger: true,
  },
  {
    type: "appointment_confirmation",
    name: "Confirmación de cita",
    description: "Cuando se agenda una reunión envía fecha, hora, link de Google Meet y mensaje de confirmación.",
    icon: "CalendarCheck2",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, confirmamos tu reunión para el {{fecha}}. Te esperamos — cualquier consulta, contactá a {{agente}}.",
    hasTrigger: false,
  },
  {
    type: "appointment_reminder",
    name: "Recordatorio de cita",
    description: "Envía un recordatorio 24 horas antes de la reunión.",
    icon: "AlarmClock",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, te recordamos tu reunión de mañana. ¡Te esperamos!",
    hasTrigger: false,
  },
  {
    type: "welcome",
    name: "Bienvenida",
    description: "Cuando un cliente nuevo entra al CRM envía un mensaje de bienvenida.",
    icon: "Hand",
    defaultEnabled: false,
    defaultMessageTemplate: "¡Hola {{nombre}}! Gracias por sumarte — soy {{agente}} y voy a acompañarte en todo lo que necesites.",
    hasTrigger: true,
  },
  {
    type: "post_sale_followup",
    name: "Seguimiento después de la venta",
    description: "Envía un mensaje unos días después de contratar la póliza.",
    icon: "Sparkles",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, ¿cómo va todo con tu póliza? Cualquier consulta, estamos para ayudarte.",
    hasTrigger: false,
  },
  {
    type: "document_request",
    name: "Solicitud de documentos",
    description: "Solicita automáticamente la documentación faltante.",
    icon: "FileText",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, nos falta un documento para continuar tu trámite. ¿Podrías enviárnoslo cuando puedas?",
    hasTrigger: false,
  },
  {
    type: "policy_renewal",
    name: "Renovación próxima",
    description: "Avisar al cliente cuando la póliza esté próxima a vencer.",
    icon: "CalendarClock",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, tu póliza está por vencer. ¿Charlamos sobre la renovación?",
    hasTrigger: true,
  },
  {
    type: "review_request",
    name: "Solicitud de reseña",
    description: "Enviar un mensaje solicitando una reseña luego de finalizar el proceso.",
    icon: "Star",
    defaultEnabled: true,
    defaultMessageTemplate: "Hola {{nombre}}, ¿nos ayudarías dejando una reseña sobre tu experiencia? Significa mucho para nosotros. 🌟",
    hasTrigger: false,
  },
];

export const AUTOMATION_VARIABLES = [
  { key: "nombre", label: "Nombre" },
  { key: "apellido", label: "Apellido" },
  { key: "empresa", label: "Empresa" },
  { key: "telefono", label: "Teléfono" },
  { key: "fecha", label: "Fecha" },
  { key: "agente", label: "Agente" },
] as const;

export function interpolateAutomationTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) result = result.replaceAll(`{{${key}}}`, value);
  return result;
}
