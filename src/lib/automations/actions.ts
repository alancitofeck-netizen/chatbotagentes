"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAutomationList, getPipelineStageOptions, type AutomationActionType, type AutomationTriggerType } from "@/lib/automations/queries";

export async function getAutomationListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getAutomationList(workspaceId);
}

export async function getPipelineStageOptionsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPipelineStageOptions(workspaceId);
}

export interface AutomationInput {
  name: string;
  triggerType: AutomationTriggerType;
  /** Required only when triggerType === 'keyword'. */
  keyword?: string;
  actionType: AutomationActionType;
  /** send_text */
  responseBody?: string;
  /** create_opportunity */
  opportunityTitle?: string;
  opportunityValue?: number;
  opportunityCurrency?: string;
  /** change_pipeline_stage */
  stageId?: string;
  /** assign_task */
  taskTitle?: string;
  assignedTo?: string | null;
  dueInHours?: number;
}

/** Builds the `trigger`/`actions` jsonb shape `runAutomation.ts`'s
 * `ACTION_EXECUTORS` registry (src/lib/automations/executors.ts) expects —
 * the one place that turns this form's input into the stored row, so the
 * two never drift apart. Throws on missing required fields per action
 * type rather than silently defaulting them. */
function buildTriggerAndActions(input: AutomationInput) {
  if (!input.name.trim()) throw new Error("El nombre es obligatorio.");

  if (input.triggerType === "keyword" && !input.keyword?.trim()) {
    throw new Error("La palabra clave es obligatoria.");
  }
  const trigger =
    input.triggerType === "any_message" ? { type: "any_message" } : { type: "keyword", keyword: input.keyword!.trim() };

  let action: Record<string, unknown>;
  switch (input.actionType) {
    case "send_text":
      if (!input.responseBody?.trim()) throw new Error("El texto de respuesta es obligatorio.");
      action = { type: "send_text", body: input.responseBody.trim() };
      break;
    case "create_opportunity":
      if (!input.opportunityTitle?.trim()) throw new Error("El título de la oportunidad es obligatorio.");
      action = {
        type: "create_opportunity",
        title: input.opportunityTitle.trim(),
        value: input.opportunityValue ?? 0,
        currency: input.opportunityCurrency?.trim() || "USD",
      };
      break;
    case "change_pipeline_stage":
      if (!input.stageId) throw new Error("Elegí una etapa del pipeline.");
      action = { type: "change_pipeline_stage", stage_id: input.stageId };
      break;
    case "assign_task":
      if (!input.taskTitle?.trim()) throw new Error("El título de la tarea es obligatorio.");
      action = {
        type: "assign_task",
        task_title: input.taskTitle.trim(),
        assigned_to: input.assignedTo || null,
        due_in_hours: input.dueInHours ?? undefined,
      };
      break;
  }

  return { trigger, actions: [action] };
}

export async function createAutomation(input: AutomationInput) {
  const { workspaceId } = await requireActiveWorkspace();
  const { trigger, actions } = buildTriggerAndActions(input);
  const supabase = await createClient();

  const { error } = await supabase.from("automations").insert({
    workspace_id: workspaceId,
    name: input.name.trim(),
    trigger,
    conditions: {},
    actions,
    enabled: true,
  });
  if (error) throw new Error("No se pudo crear la automatización.");
  revalidatePath("/automations");
}

export async function updateAutomation(id: string, input: AutomationInput) {
  const { workspaceId } = await requireActiveWorkspace();
  const { trigger, actions } = buildTriggerAndActions(input);
  const supabase = await createClient();

  await supabase
    .from("automations")
    .update({ name: input.name.trim(), trigger, actions })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  revalidatePath("/automations");
}

export async function toggleAutomationEnabled(id: string, enabled: boolean) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase.from("automations").update({ enabled }).eq("id", id).eq("workspace_id", workspaceId);
  revalidatePath("/automations");
}

/** No dependent rows exist on automations today (unlike contacts' cascade
 * into conversations/opportunities/candidates) — a real delete is safe. */
export async function deleteAutomation(id: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase.from("automations").delete().eq("id", id).eq("workspace_id", workspaceId);
  revalidatePath("/automations");
}
