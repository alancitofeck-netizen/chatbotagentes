import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ResponseMode = "auto" | "assisted";
export type AgentStatus = "active" | "inactive";

export interface BusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  days: number[];
  start: string;
  end: string;
}

export interface AiAgentListItem {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  moduleKey: string;
  channels: string[];
  model: string;
  responseMode: ResponseMode;
}

export interface AiAgentDetail extends AiAgentListItem {
  temperature: number;
  maxTokens: number;
  businessHours: BusinessHoursConfig;
  workspaceId: string;
  createdAt: string;
}

function mapAgentRow(row: Record<string, unknown>): AiAgentDetail {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    status: row.status as AgentStatus,
    moduleKey: row.module_key as string,
    channels: (row.channels as string[]) ?? [],
    model: row.model as string,
    responseMode: row.response_mode as ResponseMode,
    temperature: Number(row.temperature ?? 0.7),
    maxTokens: Number(row.max_tokens ?? 1024),
    businessHours: row.business_hours as BusinessHoursConfig,
    workspaceId: row.workspace_id as string,
    createdAt: row.created_at as string,
  };
}

const AGENT_COLUMNS =
  "id, name, description, status, module_key, channels, model, response_mode, temperature, max_tokens, business_hours, workspace_id, created_at";

export async function getAiAgentList(workspaceId: string): Promise<AiAgentListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("ai_agents").select(AGENT_COLUMNS).eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  return (data ?? []).map(mapAgentRow);
}

export async function getAiAgentDetail(workspaceId: string, agentId: string): Promise<AiAgentDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("ai_agents").select(AGENT_COLUMNS).eq("id", agentId).eq("workspace_id", workspaceId).maybeSingle();
  return data ? mapAgentRow(data) : null;
}

export interface AiPromptVersion {
  id: string;
  name: string;
  systemPrompt: string;
  variables: Record<string, string>;
  status: "draft" | "active" | "archived";
  version: number;
  createdAt: string;
}

export async function getAgentPrompts(agentId: string): Promise<AiPromptVersion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_prompts")
    .select("id, name, system_prompt, variables, status, version, created_at")
    .eq("agent_id", agentId)
    .order("version", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    systemPrompt: row.system_prompt as string,
    variables: (row.variables as Record<string, string>) ?? {},
    status: row.status as "draft" | "active" | "archived",
    version: row.version as number,
    createdAt: row.created_at as string,
  }));
}

export interface AiToolOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

/** Global catalog only (workspace_id is null) — moved from src/lib/ai-settings/queries.ts
 * as part of retiring the standalone Prompt Builder page. */
export async function getGlobalTools(): Promise<AiToolOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tools").select("id, key, name, description").is("workspace_id", null).order("name", { ascending: true });

  return (data ?? []).map((t) => ({
    id: t.id as string,
    key: t.key as string,
    name: t.name as string,
    description: t.description as string | null,
  }));
}

export async function getAgentToolIds(agentId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("agent_tools").select("tool_id").eq("agent_id", agentId);
  return (data ?? []).map((r) => r.tool_id as string);
}

export interface KnowledgeBaseEntry {
  documentId: string;
  name: string;
  status: "pending" | "ready" | "failed";
  error: string | null;
  source: string;
  createdAt: string;
}

export async function getAgentKnowledgeBase(agentId: string): Promise<KnowledgeBaseEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_knowledge_base")
    .select("document_id, status, error, created_at, documents(name, source)")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const doc = Array.isArray(row.documents) ? row.documents[0] : row.documents;
    return {
      documentId: row.document_id as string,
      name: doc?.name ?? "Documento eliminado",
      status: row.status as "pending" | "ready" | "failed",
      error: row.error as string | null,
      source: doc?.source ?? "upload",
      createdAt: row.created_at as string,
    };
  });
}

export interface AgentTestRun {
  id: string;
  testMessage: string;
  reply: string | null;
  toolTrace: { name: string; arguments: unknown; result: unknown }[];
  error: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  createdAt: string;
}

export async function getAgentTestRuns(agentId: string, limit = 30): Promise<AgentTestRun[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_test_runs")
    .select("id, test_message, reply, tool_trace, error, tokens_in, tokens_out, cost_usd, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    testMessage: row.test_message as string,
    reply: row.reply as string | null,
    toolTrace: (row.tool_trace as AgentTestRun["toolTrace"]) ?? [],
    error: row.error as string | null,
    tokensIn: row.tokens_in as number,
    tokensOut: row.tokens_out as number,
    costUsd: Number(row.cost_usd ?? 0),
    createdAt: row.created_at as string,
  }));
}

export interface AgentMetrics {
  conversationsHandled: number;
  avgLatencyMs: number | null;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  humanHandoffs: number;
  daily: { label: string; messages: number; costUsd: number }[];
}

/** Deliberately derived from usage_events/audit_log (both agent_id-tagged,
 * Motor de IA multi-agent migration) rather than `messages` — messages was
 * NOT given an agent_id column this round (bigger, riskier change to the
 * hot send path than adding two nullable columns to usage_events). */
export async function getAgentMetrics(workspaceId: string, agentId: string): Promise<AgentMetrics> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [{ data: usageRows }, { count: handoffCount }] = await Promise.all([
    supabase
      .from("usage_events")
      .select("conversation_id, tokens_in, tokens_out, cost_usd, latency_ms, created_at, is_sandbox")
      .eq("workspace_id", workspaceId)
      .eq("agent_id", agentId)
      .eq("is_sandbox", false)
      .gte("created_at", since.toISOString()),
    supabase
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("agent_id", agentId)
      .eq("action", "conversation.escalated"),
  ]);

  const rows = usageRows ?? [];
  const conversationIds = new Set(rows.map((r) => r.conversation_id).filter(Boolean));
  const latencies = rows.map((r) => r.latency_ms as number | null).filter((v): v is number => typeof v === "number");
  const totalTokensIn = rows.reduce((sum, r) => sum + Number(r.tokens_in ?? 0), 0);
  const totalTokensOut = rows.reduce((sum, r) => sum + Number(r.tokens_out ?? 0), 0);
  const totalCostUsd = rows.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  const dayBuckets = new Map<string, { label: string; messages: number; costUsd: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dayBuckets.set(d.toDateString(), { label: d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" }), messages: 0, costUsd: 0 });
  }
  for (const r of rows) {
    const key = new Date(r.created_at as string).toDateString();
    const bucket = dayBuckets.get(key);
    if (bucket) {
      bucket.messages += 1;
      bucket.costUsd += Number(r.cost_usd ?? 0);
    }
  }

  return {
    conversationsHandled: conversationIds.size,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    totalTokensIn,
    totalTokensOut,
    totalCostUsd,
    humanHandoffs: handoffCount ?? 0,
    daily: Array.from(dayBuckets.values()),
  };
}
