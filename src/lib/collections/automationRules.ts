import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface CollectionAutomationRule {
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

/** 5 reglas por defecto — 15/7/3 días antes + el día del vencimiento pedidos
 * explícitamente, más un aviso extra a los 3 días de vencido (mora
 * temprana). `moveToStatus` referencia un CollectionStatus persistido
 * (collections/constants.ts), nunca "vencido"/"proximo" (esos se derivan). */
const DEFAULT_RULES: Omit<CollectionAutomationRule, "id">[] = [
  { name: "15 días antes del vencimiento", triggerDays: 15, enabled: true, createTask: false, notifyOwner: true, suggestWhatsapp: false, sendEmail: false, moveToStatus: null, position: 0 },
  { name: "7 días antes del vencimiento", triggerDays: 7, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: true, sendEmail: false, moveToStatus: "en_seguimiento", position: 1 },
  { name: "3 días antes del vencimiento", triggerDays: 3, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: true, sendEmail: true, moveToStatus: "en_seguimiento", position: 2 },
  { name: "Vence hoy", triggerDays: 0, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: true, sendEmail: false, moveToStatus: "en_seguimiento", position: 3 },
  { name: "3 días de mora", triggerDays: -3, enabled: true, createTask: true, notifyOwner: true, suggestWhatsapp: false, sendEmail: true, moveToStatus: null, position: 4 },
];

function mapRow(r: Record<string, unknown>): CollectionAutomationRule {
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

/** Mismo patrón lazy + re-chequeo bajo service-role que ensurePolicyAutomationRules. */
export async function ensureCollectionAutomationRules(workspaceId: string): Promise<CollectionAutomationRule[]> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("collection_automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });
  if (existing && existing.length > 0) return existing.map(mapRow);

  const service = createServiceRoleClient();
  const { data: existingRace } = await service
    .from("collection_automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });
  if (existingRace && existingRace.length > 0) return existingRace.map(mapRow);

  const { data: seeded, error } = await service
    .from("collection_automation_rules")
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

export interface CollectionAutomationRulePatch {
  enabled?: boolean;
  createTask?: boolean;
  notifyOwner?: boolean;
  suggestWhatsapp?: boolean;
  sendEmail?: boolean;
  moveToStatus?: string | null;
}

export async function updateCollectionAutomationRule(workspaceId: string, ruleId: string, patch: CollectionAutomationRulePatch): Promise<void> {
  const supabase = await createClient();
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.createTask !== undefined) dbPatch.create_task = patch.createTask;
  if (patch.notifyOwner !== undefined) dbPatch.notify_owner = patch.notifyOwner;
  if (patch.suggestWhatsapp !== undefined) dbPatch.suggest_whatsapp = patch.suggestWhatsapp;
  if (patch.sendEmail !== undefined) dbPatch.send_email = patch.sendEmail;
  if (patch.moveToStatus !== undefined) dbPatch.move_to_status = patch.moveToStatus;

  const { error } = await supabase.from("collection_automation_rules").update(dbPatch).eq("id", ruleId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar la regla.");
}
