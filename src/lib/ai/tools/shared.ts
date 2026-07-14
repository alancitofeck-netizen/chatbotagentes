import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tool-handler execution context — always built with a service-role
 * client, since handlers run from a cron/webhook path with no signed-in
 * user (RLS would block every read/write otherwise).
 */
export interface ToolContext {
  supabase: SupabaseClient;
  workspaceId: string;
  conversationId: string;
  contactId: string;
  /** Stable identifier for the current buffer flush (see toolRouter.ts). */
  flushKey: string;
  /** true only for Prompt Builder sandbox runs. */
  dryRun?: boolean;
  /** The ai_agents row driving this call, if any — attributes tool_calls/
   * audit_log rows for the Métricas/Historial tabs. null for
   * Decision-Engine-direct calls (e.g. run_automation via keyword match,
   * no agent involved) and for sandbox runs against a not-yet-real agent. */
  agentId?: string | null;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

/**
 * Central prompt-injection defense (docs/blueprint/05-ai-engine.md #3):
 * never trust an id the model passed as an argument — every handler that
 * receives a `contact_id`/`automation_id`/etc. must re-verify it belongs to
 * `ctx.workspaceId` before using it. Throwing this specific, prefixed error
 * lets the Tool Router (toolRouter.ts) recognize a cross-tenant attempt and
 * log it to `audit_log` as a security event instead of a plain failure.
 */
export function crossTenantRejection(entity: string): Error {
  return new Error(`cross_tenant_id_rejected: ${entity} does not belong to this workspace`);
}
