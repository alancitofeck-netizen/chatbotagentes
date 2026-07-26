import type { ToolContext } from "@/lib/ai/tools/shared";
import { crossTenantRejection } from "@/lib/ai/tools/shared";
import { sendOutboundWhatsAppMessage } from "@/lib/messaging/send";
import { createOpportunity } from "@/lib/ai/tools/createOpportunity";

/**
 * Every field any action type might use — kept as one flat shape rather than
 * a discriminated union since `automations.actions` is stored as plain
 * jsonb (src/lib/automations/actions.ts), and each executor below only
 * reads the fields relevant to its own `type`.
 */
export interface AutomationAction {
  type: string;
  body?: string;
  title?: string;
  value?: number;
  currency?: string;
  stage_id?: string;
  task_title?: string;
  assigned_to?: string | null;
  due_in_hours?: number;
}

export type ActionExecutor = (action: AutomationAction, ctx: ToolContext) => Promise<unknown>;

/**
 * Registry of automation action executors — the ONLY place that maps an
 * `automations.actions[].type` to real side effects. Adding a future action
 * type (e.g. `send_webhook`, `notify_owner`) is one new entry here; it never
 * requires touching `runAutomation.ts`'s dispatch loop, `bufferDispatch.ts`,
 * or `decisionEngine.ts` (explicit design goal — see the WhatsApp Web /
 * automations plan).
 */
export const ACTION_EXECUTORS: Record<string, ActionExecutor> = {
  send_text: async (action, ctx) => {
    if (!action.body) throw new Error("send_text action is missing body");
    return sendOutboundWhatsAppMessage({
      supabase: ctx.supabase,
      workspaceId: ctx.workspaceId,
      conversationId: ctx.conversationId,
      content: action.body,
      senderType: "system",
      senderId: null,
    });
  },

  // Reuses the existing AI-callable `create_opportunity` tool
  // (src/lib/ai/tools/createOpportunity.ts) verbatim — same
  // pipeline/stage/opportunity/pipeline_item writes, just invoked from an
  // automation instead of the model.
  create_opportunity: async (action, ctx) =>
    createOpportunity(
      { contact_id: ctx.contactId, title: action.title ?? "Nueva oportunidad", value: action.value ?? 0, currency: action.currency ?? "USD" },
      ctx,
    ),

  change_pipeline_stage: async (action, ctx) => {
    const stageId = action.stage_id;
    if (!stageId) throw new Error("change_pipeline_stage action is missing stage_id");

    // Never trust an id straight from automations config without
    // re-verifying it belongs to this workspace (same rule every tool
    // handler follows for model-supplied ids — see tools/shared.ts).
    const { data: stage } = await ctx.supabase.from("pipeline_stages").select("id, pipeline_id").eq("id", stageId).maybeSingle();
    if (!stage) throw crossTenantRejection("stage_id");
    const { data: pipeline } = await ctx.supabase
      .from("pipelines")
      .select("id")
      .eq("id", stage.pipeline_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!pipeline) throw crossTenantRejection("stage_id");

    const { data: opportunity } = await ctx.supabase
      .from("opportunities")
      .select("id, pipeline_item_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("contact_id", ctx.contactId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!opportunity?.pipeline_item_id) throw new Error("no_open_opportunity_for_contact");

    await ctx.supabase.from("pipeline_items").update({ stage_id: stageId }).eq("id", opportunity.pipeline_item_id);
    return { opportunityId: opportunity.id, stageId };
  },

  assign_task: async (action, ctx) => {
    const title = action.task_title?.trim();
    if (!title) throw new Error("assign_task action is missing task_title");

    const dueAt = action.due_in_hours ? new Date(Date.now() + action.due_in_hours * 60 * 60 * 1000).toISOString() : null;

    const { data: task, error } = await ctx.supabase
      .from("tasks")
      .insert({
        workspace_id: ctx.workspaceId,
        title,
        related_type: "contact",
        related_id: ctx.contactId,
        assigned_to: action.assigned_to ?? null,
        due_at: dueAt,
        priority: "medium",
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !task) throw new Error("create_task_failed");
    return { taskId: task.id };
  },
};
