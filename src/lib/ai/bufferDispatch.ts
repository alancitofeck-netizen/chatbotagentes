import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { decide } from "@/lib/ai/decisionEngine";
import { runAgentTurn } from "@/lib/ai/agentRuntime";
import { applyEscalation } from "@/lib/ai/escalation";
import { executeToolDirect } from "@/lib/ai/toolRouter";
import type { ToolContext } from "@/lib/ai/tools";

export interface ConversationBufferRow {
  conversation_id: string;
  workspace_id: string;
  pending_message_ids: string[];
}

/**
 * Single entry point for a claimed buffer row (docs/blueprint/13-agent-engine.md,
 * Buffer Inteligente → Decision Engine). Called identically regardless of
 * what triggered the claim — a Vercel Cron tick today (Diseño B, see the
 * Motor de IA plan's Fase 0), or a pg_net-dispatched call later (Diseño A)
 * if pg_cron/pg_net turn out to be available on this Supabase project.
 */
export async function processClaimedBuffer(row: ConversationBufferRow): Promise<void> {
  const supabase = createServiceRoleClient();
  const { conversation_id: conversationId, workspace_id: workspaceId, pending_message_ids: messageIds } = row;

  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, created_at")
    .in("id", messageIds)
    .order("created_at", { ascending: true });

  const messageText = (messages ?? [])
    .map((m) => (m.content as { body?: string } | null)?.body ?? "")
    .filter(Boolean)
    .join("\n");

  // Stable identifier for this exact batch — part of the Tool Router's
  // idempotency key (toolRouter.ts) so a retried flush of the same batch
  // doesn't re-execute a side-effecting tool twice.
  const flushKey = [...messageIds].sort().join(",");

  try {
    const outcome = await decide({ supabase, workspaceId, conversationId, messageText });

    switch (outcome.type) {
      case "ai_respond":
        await runAgentTurn({
          workspaceId,
          conversationId,
          promptId: outcome.promptId,
          agentId: outcome.agentId,
          moduleKey: outcome.moduleKey,
          responseMode: outcome.responseMode,
          bufferedMessageText: messageText,
          flushKey,
        });
        break;

      case "run_automation": {
        const { data: conversation } = await supabase
          .from("conversations")
          .select("contact_id")
          .eq("id", conversationId)
          .maybeSingle();
        const toolCtx: ToolContext = {
          supabase,
          workspaceId,
          conversationId,
          contactId: (conversation?.contact_id as string) ?? "",
          flushKey,
        };
        await executeToolDirect("run_automation", { automation_id: outcome.automationId }, toolCtx);
        break;
      }

      case "escalate":
        await applyEscalation(supabase, { workspaceId, conversationId, reason: outcome.reason });
        break;

      case "human_respond":
      case "wait":
      case "invoke_tool_directly":
        // human_respond/wait: no action, the batch stays visible in the
        // inbox for a human. invoke_tool_directly is unreachable from the
        // Decision Engine this round (no automation shape produces it yet,
        // reserved for a future "invoke a tool with no reasoning" trigger).
        break;
    }
  } catch (err) {
    console.error(`[bufferDispatch] failed to process conversation ${conversationId}:`, err);
  } finally {
    // Diff-based cleanup (04-inbox.md paso 4): only remove the ids actually
    // processed, never a blind reset — new messages may have arrived (and
    // re-flagged the row 'pending') while this ran.
    await supabase.rpc("clear_processed_buffer_messages", {
      p_conversation_id: conversationId,
      p_processed_message_ids: messageIds,
    });
  }
}
