import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared escalation side-effect (docs/blueprint/05-ai-engine.md, "Degradación
 * por fallo o cuota" + "Handoff humano") — reused by the Decision Engine
 * (escalate outcome) and by Agent Runtime when the model calls
 * `request_human_handoff` mid-turn, so "how to escalate" has one
 * implementation, not two.
 */
export async function applyEscalation(
  supabase: SupabaseClient,
  params: { workspaceId: string; conversationId: string; reason: string; agentId?: string | null },
): Promise<void> {
  await supabase
    .from("conversations")
    .update({ status: "pending_human" })
    .eq("id", params.conversationId)
    .eq("workspace_id", params.workspaceId);

  await supabase.from("audit_log").insert({
    workspace_id: params.workspaceId,
    actor_type: "system",
    actor_id: null,
    agent_id: params.agentId ?? null,
    action: "conversation.escalated",
    entity_type: "conversation",
    entity_id: params.conversationId,
    metadata: { reason: params.reason },
  });
}
