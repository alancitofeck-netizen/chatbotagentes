import type { ToolContext } from "@/lib/ai/tools/shared";

/** `request_human_handoff` — no side effect of its own. Agent Runtime
 * (agentRuntime.ts) recognizes this tool by name specially: it breaks the
 * tool-call loop and calls the shared `applyEscalation` (escalation.ts)
 * instead of feeding the result back to the model for another turn. */
export async function requestHumanHandoff(args: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
  void _ctx;
  return { requestedHandoff: true, reason: String(args.reason ?? "") };
}
