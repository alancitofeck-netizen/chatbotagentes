import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyManagers } from "@/lib/notifications/service";

/** Reasons that mean something actually broke (provider/config/response
 * failure) vs. normal business-flow escalations (outside business hours,
 * no active agent, contact opted out, model asked for a human, etc.) —
 * only the former notify "Error de ejecución" per the notifications spec.
 * `quota_exceeded` gets its own distinct event (ai_quota_exceeded). */
const EXECUTION_ERROR_REASONS = new Set(["provider_failure", "openrouter_not_configured", "empty_model_response", "draft_persist_failed"]);

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

  if (params.reason === "quota_exceeded") {
    await notifyManagers(params.workspaceId, {
      eventType: "ai_quota_exceeded",
      title: "Límite de uso de IA alcanzado",
      message: "El presupuesto mensual de IA de este workspace ya se agotó — las conversaciones están escalando a humano.",
      actionUrl: "/inbox",
    });
  } else if (EXECUTION_ERROR_REASONS.has(params.reason)) {
    await notifyManagers(params.workspaceId, {
      eventType: "ai_execution_error",
      title: "Error de ejecución de IA",
      message: `Una conversación escaló a humano por un error (${params.reason}).`,
      actionUrl: "/inbox",
    });
  }
}
