import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PolicyAutomationRule {
  id: string;
  name: string;
  triggerDays: number;
  enabled: boolean;
  createTask: boolean;
  notifyOwner: boolean;
  suggestWhatsapp: boolean;
  sendEmail: boolean;
  moveToStatus: string | null;
  position: number;
}

/** 7 reglas por defecto — mismos umbrales pedidos explícitamente (90/60/30/
 * 15/7/1 días antes + el día del vencimiento), con acciones progresivamente
 * más urgentes a medida que se acerca la fecha. `moveToStatus` referencia
 * las claves de POLICY_STAGES (constants.ts). */
const DEFAULT_RULES: Omit<PolicyAutomationRule, "id">[] = [
  { name: "90 días antes del vencimiento", triggerDays: 90, enabled: true, createTask: false, notifyOwner: true, suggestWhatsapp: false, sendEmail: false, moveToStatus: null, position: 0 },
  { name: "60 días antes del vencimiento", triggerDays: 60, enabled: true, createTask: false, notifyOwner: true, suggestWhatsapp: false, sendEmail: false, moveToStatus: "renovacion_proxima", position: 1 },
  { name: "30 días antes del vencimiento", triggerDays: 30, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: true, sendEmail: false, moveToStatus: null, position: 2 },
  { name: "15 días antes del vencimiento", triggerDays: 15, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: true, sendEmail: true, moveToStatus: null, position: 3 },
  { name: "7 días antes del vencimiento", triggerDays: 7, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: true, sendEmail: true, moveToStatus: "renovacion_enviada", position: 4 },
  { name: "1 día antes del vencimiento", triggerDays: 1, enabled: true, createTask: false, notifyOwner: true, suggestWhatsapp: false, sendEmail: false, moveToStatus: null, position: 5 },
  { name: "Póliza vencida", triggerDays: 0, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: false, sendEmail: false, moveToStatus: "vencida", position: 6 },
];

function mapRow(r: Record<string, unknown>): PolicyAutomationRule {
  return {
    id: r.id as string,
    name: r.name as string,
    triggerDays: r.trigger_days as number,
    enabled: r.enabled as boolean,
    createTask: r.create_task as boolean,
    notifyOwner: r.notify_owner as boolean,
    suggestWhatsapp: r.suggest_whatsapp as boolean,
    sendEmail: r.send_email as boolean,
    moveToStatus: (r.move_to_status as string | null) ?? null,
    position: r.position as number,
  };
}

/** Mismo patrón lazy que ensurePolicyPipeline: siembra las 7 reglas por
 * defecto en el primer uso real de este workspace, con re-chequeo bajo
 * service-role para evitar una carrera entre dos primeras visitas. */
export async function ensurePolicyAutomationRules(workspaceId: string): Promise<PolicyAutomationRule[]> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("policy_automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });
  if (existing && existing.length > 0) return existing.map(mapRow);

  const service = createServiceRoleClient();
  const { data: existingRace } = await service
    .from("policy_automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });
  if (existingRace && existingRace.length > 0) return existingRace.map(mapRow);

  const { data: seeded, error } = await service
    .from("policy_automation_rules")
    .insert(
      DEFAULT_RULES.map((r) => ({
        workspace_id: workspaceId,
        name: r.name,
        trigger_days: r.triggerDays,
        enabled: r.enabled,
        create_task: r.createTask,
        notify_owner: r.notifyOwner,
        suggest_whatsapp: r.suggestWhatsapp,
        send_email: r.sendEmail,
        move_to_status: r.moveToStatus,
        position: r.position,
      })),
    )
    .select("*")
    .order("position", { ascending: true });
  if (error || !seeded) throw new Error("No se pudieron crear las reglas de automatización por defecto.");
  return seeded.map(mapRow);
}

export interface PolicyAutomationRulePatch {
  enabled?: boolean;
  createTask?: boolean;
  notifyOwner?: boolean;
  suggestWhatsapp?: boolean;
  sendEmail?: boolean;
  moveToStatus?: string | null;
}

export async function updatePolicyAutomationRule(workspaceId: string, ruleId: string, patch: PolicyAutomationRulePatch): Promise<void> {
  const supabase = await createClient();
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.createTask !== undefined) dbPatch.create_task = patch.createTask;
  if (patch.notifyOwner !== undefined) dbPatch.notify_owner = patch.notifyOwner;
  if (patch.suggestWhatsapp !== undefined) dbPatch.suggest_whatsapp = patch.suggestWhatsapp;
  if (patch.sendEmail !== undefined) dbPatch.send_email = patch.sendEmail;
  if (patch.moveToStatus !== undefined) dbPatch.move_to_status = patch.moveToStatus;

  const { error } = await supabase.from("policy_automation_rules").update(dbPatch).eq("id", ruleId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar la regla.");
}
