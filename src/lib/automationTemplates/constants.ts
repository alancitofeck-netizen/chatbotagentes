/** Client-safe. El catálogo de automatizaciones (nombre/descripción/ícono/
 * categoría/defaults) YA NO vive acá — vive en automation_catalog (0110),
 * una tabla GLOBAL (mismo patrón que insurance_providers), para que agregar
 * la automatización #16 sea un INSERT, no un redeploy. Acá solo queda lo
 * que de verdad tiene que ser código: las variables de mensaje y el
 * intérprete de plantilla. */

export const AUTOMATION_CATEGORIES = ["Clientes", "Ventas", "Cobranza", "Pólizas", "Agenda", "IA", "Marketing"] as const;
export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[number];

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
