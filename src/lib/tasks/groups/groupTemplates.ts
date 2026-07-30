import type { GroupColor } from "./queries";

export interface GroupTemplate {
  key: string;
  label: string;
  icon: string;
  color: GroupColor;
  description: string;
  taskTitles: string[];
}

/** Fixed built-in catalog — "Permitir crear plantillas" from the brief is
 * scoped here to *choosing* one of these to instantiate a group, not a
 * user-authored template builder (a real but separate feature, left as a
 * documented future extension — see the Escalabilidad note in the plan). */
export const GROUP_TEMPLATES: GroupTemplate[] = [
  {
    key: "crm_project",
    label: "Proyecto CRM",
    icon: "💻",
    color: "accent",
    description: "Plan de desarrollo del CRM.",
    taskTitles: ["Dashboard", "Backend", "Frontend", "Testing", "Deploy", "Documentación"],
  },
  {
    key: "marketing_campaign",
    label: "Campaña de Marketing",
    icon: "📣",
    color: "warning",
    description: "Plan de campaña de marketing.",
    taskTitles: ["Definir audiencia", "Diseñar creatividades", "Configurar anuncios", "Publicar contenido", "Medir resultados"],
  },
];
