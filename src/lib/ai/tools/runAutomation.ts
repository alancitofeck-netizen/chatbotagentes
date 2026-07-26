import type { ToolContext } from "@/lib/ai/tools/shared";
import { crossTenantRejection } from "@/lib/ai/tools/shared";
import { ACTION_EXECUTORS, type AutomationAction } from "@/lib/automations/executors";

/** `run_automation` — side-effecting. Executes an `automations` row's
 * `actions` (src/lib/automations/actions.ts) by dispatching each one
 * through the `ACTION_EXECUTORS` registry (src/lib/automations/executors.ts)
 * — this file no longer hardcodes any single action's logic, just the
 * dispatch/error-isolation loop. Used both when the model calls this tool
 * directly, and when the Decision Engine matches a keyword trigger without
 * invoking the model at all (bufferDispatch.ts calls this same handler via
 * executeToolDirect), and when a workspace's `any_message` automations run
 * as a side effect alongside the AI's own response (also bufferDispatch.ts).
 *
 * Each action in the same automation is executed independently
 * (`Promise.allSettled`) — one action failing (e.g. a stale `stage_id`)
 * never stops the other actions in the same automation from running, and
 * every failure is logged rather than thrown, matching the "una automatización
 * que falla no debe afectar la conversación" requirement. */
export async function runAutomation(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const automationId = String(args.automation_id ?? "");

  const { data: automation } = await ctx.supabase
    .from("automations")
    .select("id, actions, enabled")
    .eq("id", automationId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!automation) throw crossTenantRejection("automation_id");
  if (!automation.enabled) throw new Error("automation_disabled");

  const actions = (automation.actions as AutomationAction[] | null) ?? [];

  const settled = await Promise.allSettled(
    actions.map(async (action) => {
      const executor = ACTION_EXECUTORS[action.type];
      if (!executor) throw new Error(`unknown_action_type: ${action.type}`);
      return executor(action, ctx);
    }),
  );

  const results = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") return { actionType: actions[i]?.type, ok: true, result: outcome.value };
    console.error(`[runAutomation] action failed (automation=${automationId}, type=${actions[i]?.type}):`, outcome.reason);
    return { actionType: actions[i]?.type, ok: false, error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) };
  });

  return { executed: results };
}
