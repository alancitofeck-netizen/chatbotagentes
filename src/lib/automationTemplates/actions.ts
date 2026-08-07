"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { ensureAutomationTemplates, type AutomationTemplate } from "@/lib/automationTemplates/queries";

function revalidateAutomations() {
  revalidatePath("/automatizaciones");
}

export interface AutomationsBoard {
  automations: AutomationTemplate[];
  total: number;
  activeCount: number;
  inactiveCount: number;
}

export async function getAutomationsBoardAction(): Promise<AutomationsBoard> {
  const { workspaceId } = await requireActiveWorkspace();
  const automations = await ensureAutomationTemplates(workspaceId);
  const activeCount = automations.filter((a) => a.enabled).length;
  return { automations, total: automations.length, activeCount, inactiveCount: automations.length - activeCount };
}

export interface AutomationPatch {
  enabled?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  messageTemplate?: string;
}

/** "Renovación próxima" no dispara un motor propio — ver la nota en
 * constants.ts: prender/apagar esta automatización prende/apaga
 * suggest_whatsapp en las policy_automation_rules ya existentes (Pólizas),
 * para no correr dos motores independientes que podrían crear una tarea
 * duplicada para la misma póliza el mismo día. */
async function syncPolicyRenewalEngine(workspaceId: string, enabled: boolean) {
  const supabase = await createClient();
  await supabase.from("policy_automation_rules").update({ suggest_whatsapp: enabled, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId);
}

export async function updateAutomationAction(automationId: string, patch: AutomationPatch): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: current } = await supabase.from("automation_templates").select("type").eq("id", automationId).eq("workspace_id", workspaceId).maybeSingle();
  if (!current) throw new Error("Automatización no encontrada.");

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.whatsappEnabled !== undefined) dbPatch.whatsapp_enabled = patch.whatsappEnabled;
  if (patch.emailEnabled !== undefined) dbPatch.email_enabled = patch.emailEnabled;
  if (patch.messageTemplate !== undefined) dbPatch.message_template = patch.messageTemplate;

  const { error } = await supabase.from("automation_templates").update(dbPatch).eq("id", automationId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar la automatización.");

  if (current.type === "policy_renewal" && patch.enabled !== undefined) {
    await syncPolicyRenewalEngine(workspaceId, patch.enabled);
  }

  revalidateAutomations();
}
