import type { ToolContext } from "@/lib/ai/tools/shared";
import { crossTenantRejection } from "@/lib/ai/tools/shared";
import { sendOutboundWhatsAppMessage } from "@/lib/messaging/send";

interface AutomationAction {
  type: string;
  body?: string;
}

/** `run_automation` — side-effecting. Executes an `automations` row's
 * `actions` (today's only shape, src/lib/automations/actions.ts:
 * `[{type:'send_text', body}]`) — doesn't invent new automation semantics.
 * Used both when the model calls this tool directly, and when the Decision
 * Engine matches a keyword trigger without invoking the model at all
 * (bufferDispatch.ts calls this same handler via executeToolDirect). */
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
  const results: unknown[] = [];

  for (const action of actions) {
    if (action.type === "send_text" && action.body) {
      const result = await sendOutboundWhatsAppMessage({
        supabase: ctx.supabase,
        workspaceId: ctx.workspaceId,
        conversationId: ctx.conversationId,
        content: action.body,
        senderType: "system",
        senderId: null,
      });
      results.push(result);
    }
  }

  return { executed: results };
}
