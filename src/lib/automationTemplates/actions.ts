"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAutomationsBoard, getAutomationStats, getAutomationHistory, type AutomationTemplate, type AutomationStats, type AutomationHistoryEntry } from "@/lib/automationTemplates/queries";

function revalidateAutomations() {
  revalidatePath("/automatizaciones");
}

export interface AutomationsBoardResult {
  automations: AutomationTemplate[];
  stats: AutomationStats;
}

export async function getAutomationsBoardAction(): Promise<AutomationsBoardResult> {
  const { workspaceId } = await requireActiveWorkspace();
  const automations = await getAutomationsBoard(workspaceId);
  const stats = await getAutomationStats(workspaceId, automations);
  return { automations, stats };
}

export async function getAutomationHistoryAction(): Promise<AutomationHistoryEntry[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getAutomationHistory(workspaceId);
}

export interface AutomationPatch {
  enabled?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  messageTemplate?: string;
}

/** "Renovación de póliza" no dispara un motor propio — prende/apaga
 * suggest_whatsapp en las policy_automation_rules ya existentes (Pólizas),
 * para no correr dos motores independientes que podrían crear una tarea
 * duplicada para la misma póliza el mismo día. */
async function syncPolicyRenewalEngine(workspaceId: string, enabled: boolean) {
  const supabase = await createClient();
  await supabase.from("policy_automation_rules").update({ suggest_whatsapp: enabled, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId);
}

/** Catálogo global + override por workspace (0110) — la primera vez que un
 * workspace toca una automatización (togglea o edita), esto crea su fila en
 * automation_templates; las siguientes veces la actualiza. Nunca hace falta
 * sembrar las 15 filas de antemano. */
export async function updateAutomationAction(type: string, patch: AutomationPatch): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: existing } = await supabase.from("automation_templates").select("id").eq("workspace_id", workspaceId).eq("type", type).maybeSingle();

  if (existing) {
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
    if (patch.whatsappEnabled !== undefined) dbPatch.whatsapp_enabled = patch.whatsappEnabled;
    if (patch.emailEnabled !== undefined) dbPatch.email_enabled = patch.emailEnabled;
    if (patch.messageTemplate !== undefined) dbPatch.message_template = patch.messageTemplate;
    const { error } = await supabase.from("automation_templates").update(dbPatch).eq("id", existing.id as string);
    if (error) throw new Error("No se pudo actualizar la automatización.");
  } else {
    const { data: catalogEntry } = await supabase.from("automation_catalog").select("default_enabled, default_message_template").eq("key", type).maybeSingle();
    if (!catalogEntry) throw new Error("Automatización no encontrada.");
    const { error } = await supabase.from("automation_templates").insert({
      workspace_id: workspaceId,
      type,
      enabled: patch.enabled ?? (catalogEntry.default_enabled as boolean),
      whatsapp_enabled: patch.whatsappEnabled ?? true,
      email_enabled: patch.emailEnabled ?? false,
      message_template: patch.messageTemplate ?? (catalogEntry.default_message_template as string),
    });
    if (error) throw new Error("No se pudo guardar la automatización.");
  }

  if (type === "policy_renewal" && patch.enabled !== undefined) {
    await syncPolicyRenewalEngine(workspaceId, patch.enabled);
  }

  revalidateAutomations();
}
