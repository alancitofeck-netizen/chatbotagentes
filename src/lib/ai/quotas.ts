import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Fallback defaults when a workspace has no `workspace_quotas` row yet — same
// "absence of a row = platform default" convention as workspace_modules.
// Generous on purpose so a fresh workspace isn't quota-blocked out of the box.
export const DEFAULT_AI_MONTHLY_BUDGET_USD = 20;
export const DEFAULT_AI_REQUESTS_PER_MINUTE = 20;

// Rough per-token estimate, used ONLY when OpenRouter's response doesn't
// report `usage.cost` directly (see src/lib/integrations/openrouter.ts) —
// modeled on a cheap/fast model's published pricing. Refine once real
// OpenRouter responses are confirmed to always include `usage.cost`.
export const ESTIMATED_COST_PER_INPUT_TOKEN_USD = 0.15 / 1_000_000;
export const ESTIMATED_COST_PER_OUTPUT_TOKEN_USD = 0.6 / 1_000_000;

export function estimateCostUsd(tokensIn: number, tokensOut: number): number {
  return tokensIn * ESTIMATED_COST_PER_INPUT_TOKEN_USD + tokensOut * ESTIMATED_COST_PER_OUTPUT_TOKEN_USD;
}

/** Shared by the Decision Engine (authoritative preflight check) and Agent
 * Runtime (cheap defensive re-check in case something ever invokes it
 * without going through the Decision Engine first). */
export async function isQuotaExceeded(supabase: SupabaseClient, workspaceId: string): Promise<boolean> {
  const { data: quotaRow } = await supabase
    .from("workspace_quotas")
    .select("ai_monthly_budget_usd")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const budget = quotaRow?.ai_monthly_budget_usd ?? DEFAULT_AI_MONTHLY_BUDGET_USD;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: usageRows } = await supabase
    .from("usage_events")
    .select("cost_usd")
    .eq("workspace_id", workspaceId)
    .eq("is_sandbox", false)
    .gte("created_at", monthStart.toISOString());
  const spentUsd = (usageRows ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  return spentUsd >= budget;
}
