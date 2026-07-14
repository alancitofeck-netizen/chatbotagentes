import "server-only";
import crypto from "node:crypto";
import Ajv from "ajv";
import { handlers, SIDE_EFFECTING_HANDLER_KEYS, type ToolContext } from "@/lib/ai/tools";

/**
 * Tool Router (docs/blueprint/13-agent-engine.md #5) — the model never
 * executes a tool directly. This is the only place that decides/controls
 * real execution: schema validation, workspace-id re-validation (handled
 * inside each handler, see tools/shared.ts's crossTenantRejection),
 * idempotency, tool_calls logging, dispatch.
 */

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

async function runPipeline(
  toolKey: string,
  rawArgs: unknown,
  ctx: ToolContext,
  requireAgentToolsGateForAgentId: string | null,
): Promise<ToolResult> {
  const { data: tool } = await ctx.supabase
    .from("tools")
    .select("id, handler_key, json_schema, enabled")
    .eq("key", toolKey)
    .maybeSingle();

  if (!tool || !tool.enabled) {
    return { ok: false, error: "tool_not_found_or_disabled" };
  }

  if (requireAgentToolsGateForAgentId) {
    const { data: gate } = await ctx.supabase
      .from("agent_tools")
      .select("tool_id")
      .eq("agent_id", requireAgentToolsGateForAgentId)
      .eq("tool_id", tool.id)
      .maybeSingle();
    if (!gate) {
      return { ok: false, error: "tool_not_enabled_for_agent" };
    }
  }

  const validate = ajv.compile((tool.json_schema as object) ?? {});
  if (!validate(rawArgs)) {
    return { ok: false, error: `invalid_arguments: ${ajv.errorsText(validate.errors)}` };
  }
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  const handlerKey = tool.handler_key as string;
  const handler = handlers[handlerKey];
  if (!handler) {
    return { ok: false, error: "handler_not_implemented" };
  }

  // Sandbox (Prompt Builder "Probar", Fase 7): side-effecting tools never
  // touch real data, read-only tools run for real so the tester sees
  // genuine context — nothing is logged to tool_calls either way.
  if (ctx.dryRun) {
    if (SIDE_EFFECTING_HANDLER_KEYS.has(handlerKey)) {
      return { ok: true, result: { simulated: true } };
    }
    try {
      const result = await handler(args, ctx);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "handler_failed" };
    }
  }

  const idempotencyKey = crypto
    .createHash("sha256")
    .update(`${ctx.conversationId}:${ctx.flushKey}:${toolKey}:${stableStringify(args)}`)
    .digest("hex");

  const { error: insertError } = await ctx.supabase.from("tool_calls").insert({
    workspace_id: ctx.workspaceId,
    conversation_id: ctx.conversationId,
    tool_id: tool.id,
    agent_id: ctx.agentId ?? null,
    idempotency_key: idempotencyKey,
    arguments: args,
    status: "validated",
  });

  if (insertError) {
    // Unique violation on idempotency_key => this exact call already ran —
    // return the recorded outcome instead of executing it again.
    const { data: existing } = await ctx.supabase
      .from("tool_calls")
      .select("status, result, error")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return { ok: existing.status === "executed", result: existing.result, error: existing.error ?? undefined };
    }
    return { ok: false, error: "tool_call_log_failed" };
  }

  const startedAt = Date.now();
  try {
    const result = await handler(args, ctx);
    await ctx.supabase
      .from("tool_calls")
      .update({ status: "executed", result, latency_ms: Date.now() - startedAt })
      .eq("idempotency_key", idempotencyKey);
    await ctx.supabase.from("audit_log").insert({
      workspace_id: ctx.workspaceId,
      actor_type: "ai",
      actor_id: null,
      agent_id: ctx.agentId ?? null,
      action: `tool.${toolKey}`,
      entity_type: "conversation",
      entity_id: ctx.conversationId,
      metadata: { arguments: args, result },
    });
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler_failed";
    await ctx.supabase
      .from("tool_calls")
      .update({ status: "failed", error: message, latency_ms: Date.now() - startedAt })
      .eq("idempotency_key", idempotencyKey);

    if (message.startsWith("cross_tenant_id_rejected")) {
      await ctx.supabase.from("audit_log").insert({
        workspace_id: ctx.workspaceId,
        actor_type: "system",
        actor_id: null,
        action: "security.tool_cross_tenant_id_rejected",
        entity_type: "conversation",
        entity_id: ctx.conversationId,
        metadata: { toolKey, arguments: args, error: message },
      });
    }
    return { ok: false, error: message };
  }
}

/** Model-driven invocation — also gates on `agent_tools` (the tool must be
 * assigned to the agent, not just any prompt version of it). */
export async function executeToolForModel(toolKey: string, rawArgs: unknown, ctx: ToolContext, agentId: string): Promise<ToolResult> {
  return runPipeline(toolKey, rawArgs, ctx, agentId);
}

/** Direct invocation — Decision Engine's `run_automation` outcome (keyword
 * match, model never invoked). Skips the `agent_tools` gate since there's no
 * agent turn to check against, but goes through the same validation/
 * idempotency/logging pipeline. */
export async function executeToolDirect(toolKey: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  return runPipeline(toolKey, rawArgs, ctx, null);
}
