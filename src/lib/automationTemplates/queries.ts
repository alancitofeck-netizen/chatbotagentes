import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AUTOMATION_CATALOG, AUTOMATION_TYPES, type AutomationType } from "@/lib/automationTemplates/constants";

export interface AutomationTemplate {
  id: string;
  type: AutomationType;
  name: string;
  description: string;
  enabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  messageTemplate: string;
  icon: string;
  hasTrigger: boolean;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): AutomationTemplate {
  const type = r.type as AutomationType;
  const catalogEntry = AUTOMATION_CATALOG.find((c) => c.type === type);
  return {
    id: r.id as string,
    type,
    name: r.name as string,
    description: r.description as string,
    enabled: r.enabled as boolean,
    whatsappEnabled: r.whatsapp_enabled as boolean,
    emailEnabled: r.email_enabled as boolean,
    smsEnabled: r.sms_enabled as boolean,
    messageTemplate: r.message_template as string,
    icon: catalogEntry?.icon ?? "Sparkles",
    hasTrigger: catalogEntry?.hasTrigger ?? false,
    updatedAt: r.updated_at as string,
  };
}

/** Siembra perezosamente, por workspace, las filas que falten del catálogo
 * fijo (constants.ts) — mismo patrón que ensurePolicyPipeline/
 * ensurePolicyAutomationRules, pero apoyado en el unique(workspace_id, type)
 * real de la tabla (upsert con ignoreDuplicates) en vez del dance manual de
 * select+insert+recheck bajo service-role: acá la propia constraint ya
 * resuelve la carrera entre dos primeras visitas simultáneas. Agregar una
 * automatización nueva a futuro es sumarla a AUTOMATION_CATALOG — se siembra
 * sola en cada workspace la próxima vez que alguien abra este módulo, sin
 * tocar ningún otro código.
 *
 * Vive en src/lib/automationTemplates/ (no src/lib/automations/) a
 * propósito: ese último nombre ya lo usa un módulo completamente distinto
 * (constructor de automatizaciones disparadas por conversación de WhatsApp,
 * ver src/lib/automations/executors.ts, expuesto en Perfil/Configuración) —
 * mismo dominio conceptual ("automatización"), features distintas. */
export async function ensureAutomationTemplates(workspaceId: string): Promise<AutomationTemplate[]> {
  const supabase = await createClient();

  const { data: existing } = await supabase.from("automation_templates").select("*").eq("workspace_id", workspaceId);
  const existingTypes = new Set((existing ?? []).map((r) => r.type as string));
  const missing = AUTOMATION_CATALOG.filter((c) => !existingTypes.has(c.type));

  if (missing.length > 0) {
    await supabase.from("automation_templates").upsert(
      missing.map((c) => ({
        workspace_id: workspaceId,
        type: c.type,
        name: c.name,
        description: c.description,
        enabled: c.defaultEnabled,
        message_template: c.defaultMessageTemplate,
      })),
      { onConflict: "workspace_id,type", ignoreDuplicates: true },
    );
  }

  const { data } = await supabase.from("automation_templates").select("*").eq("workspace_id", workspaceId);
  const rows = (data ?? []).map(mapRow);
  return rows.sort((a, b) => AUTOMATION_TYPES.indexOf(a.type) - AUTOMATION_TYPES.indexOf(b.type));
}
