import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AutomationTriggerType = "keyword" | "any_message";
export type AutomationActionType = "send_text" | "create_opportunity" | "change_pipeline_stage" | "assign_task";

export interface AutomationListItem {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  triggerKeyword: string | null;
  actionType: AutomationActionType;
  actionBody: string | null;
  actionTitle: string | null;
  actionValue: number | null;
  actionCurrency: string | null;
  actionStageId: string | null;
  actionTaskTitle: string | null;
  actionAssignedTo: string | null;
  actionDueInHours: number | null;
  createdAt: string;
}

interface TriggerShape {
  type?: string;
  keyword?: string;
}
interface ActionShape {
  type?: string;
  body?: string;
  title?: string;
  value?: number;
  currency?: string;
  stage_id?: string;
  task_title?: string;
  assigned_to?: string | null;
  due_in_hours?: number;
}

/**
 * Reads `trigger`/`actions` jsonb — extended (src/lib/automations/executors.ts)
 * from the original "keyword trigger / send_text action" shape to also
 * support `any_message` triggers and `create_opportunity`/
 * `change_pipeline_stage`/`assign_task` actions. Still one action per
 * automation in this UI (the underlying `actions` column stays an array for
 * forward compatibility, but nothing here manages more than
 * `actions[0]`) — every action type requested so far is expressible as a
 * single action, so multi-action automations aren't exposed in the UI yet.
 */
export async function getAutomationList(workspaceId: string): Promise<AutomationListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automations")
    .select("id, name, enabled, trigger, actions, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const trigger = (row.trigger ?? {}) as TriggerShape;
    const actions = (row.actions ?? []) as ActionShape[];
    const action = actions[0] ?? {};
    return {
      id: row.id as string,
      name: row.name as string,
      enabled: row.enabled as boolean,
      triggerType: trigger.type === "any_message" ? "any_message" : "keyword",
      triggerKeyword: trigger.keyword ?? null,
      actionType: (action.type as AutomationActionType | undefined) ?? "send_text",
      actionBody: action.body ?? null,
      actionTitle: action.title ?? null,
      actionValue: action.value ?? null,
      actionCurrency: action.currency ?? null,
      actionStageId: action.stage_id ?? null,
      actionTaskTitle: action.task_title ?? null,
      actionAssignedTo: action.assigned_to ?? null,
      actionDueInHours: action.due_in_hours ?? null,
      createdAt: row.created_at as string,
    };
  });
}

export interface PipelineStageOption {
  id: string;
  name: string;
}

/** For the "Cambiar etapa del pipeline" action's stage picker — same
 * pipeline resolution rule as the AI's own `create_opportunity` tool
 * (src/lib/ai/tools/createOpportunity.ts: the workspace's `module_key='crm'`
 * pipeline), so an automation only ever targets a stage the AI could also
 * reach. */
export async function getPipelineStageOptions(workspaceId: string): Promise<PipelineStageOption[]> {
  const supabase = await createClient();
  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", "crm")
    .limit(1)
    .maybeSingle();
  if (!pipeline) return [];

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true });

  return (stages ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
}
