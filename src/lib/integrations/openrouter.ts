import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * OpenRouter adapter (`LLMProvider`, docs/blueprint/08-integrations.md) — the
 * only place in the codebase that calls OpenRouter's HTTP API directly.
 * Mirrors src/lib/integrations/ycloud.ts's shape (credential resolver +
 * plain-fetch call), same "adapter, not SDK" convention as the rest of
 * src/lib/integrations/.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

export interface OpenRouterCredentials {
  apiKey: string;
}

/**
 * Resolves a workspace's own OpenRouter API key from Supabase Vault via
 * `public.get_openrouter_credentials` (SECURITY DEFINER,
 * supabase/migrations/0021_openrouter_integration_vault.sql), whose EXECUTE
 * grant is restricted to `service_role` — `supabase` here MUST be a
 * `createServiceRoleClient()` instance, same rule as getYCloudCredentials.
 * Never forward `apiKey` to the browser or log it.
 */
export async function getOpenRouterCredentials(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<OpenRouterCredentials | null> {
  const { data, error } = await supabase.rpc("get_openrouter_credentials", { p_workspace_id: workspaceId }).maybeSingle();

  if (error) {
    console.error(`[openrouter] failed to resolve credentials for workspace ${workspaceId}:`, error);
    return null;
  }

  const row = data as { api_key: string } | null;
  if (!row || !row.api_key) return null;

  return { apiKey: row.api_key };
}

/**
 * Wrapper around getOpenRouterCredentials for every AI Server Action in the
 * app — returns the "no está conectado" case as DATA instead of throwing.
 *
 * Root cause (found via production logs after agents reported every AI
 * feature crashing for them while it worked for the owner): every agent
 * gets their OWN freshly-provisioned workspace with no OpenRouter connected
 * yet (provision-workspace.ts never seeds it, by design — it's a per-tenant
 * credential). The previous `if (!credentials) throw new Error(...)` guard,
 * present at the top of every one of these actions, doesn't reliably
 * survive the Server Action boundary in this app's production build — some
 * throws (confirmed live for extractPolicyFromPdfAction) surface to the
 * client as an opaque "Server Components render" crash instead of a
 * rejected promise the caller's own try/catch can show as a toast (same
 * class of issue already documented in agentRuntime.ts's SandboxTurnResult
 * — "a thrown Error crossing the Server Action boundary was observed to
 * surface... as a generic redacted message"). Returning the error as data
 * sidesteps it entirely, same fix already proven there.
 */
export type OpenRouterKeyResult = { ok: true; apiKey: string } | { ok: false; error: string };

export async function resolveOpenRouterApiKey(supabase: SupabaseClient, workspaceId: string, featureLabel: string): Promise<OpenRouterKeyResult> {
  const credentials = await getOpenRouterCredentials(supabase, workspaceId);
  if (!credentials) return { ok: false, error: `Conectá OpenRouter primero (Perfil → Integraciones) para poder ${featureLabel}.` };
  return { ok: true, apiKey: credentials.apiKey };
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
}

export interface OpenRouterToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenRouterProviderPrefs {
  order?: string[];
  sort?: "price" | "throughput" | "latency";
  allow_fallbacks?: boolean;
}

export interface OpenRouterCompletionResult {
  message: OpenRouterMessage | null;
  toolCalls: OpenRouterToolCall[];
  usage: { promptTokens: number; completionTokens: number; costUsd: number | null } | null;
  model: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POSTs a single chat-completion turn. Retries with backoff+jitter on
 * network errors / 5xx — independent of OpenRouter's own `models[]`
 * fallback chain (docs/blueprint/08-integrations.md), which OpenRouter
 * already applies internally across the `models` array passed below.
 */
export async function complete(input: {
  apiKey: string;
  messages: OpenRouterMessage[];
  tools: OpenRouterToolDef[];
  models: string[];
  /** Per-agent config (ai_agents.temperature/max_tokens) — previously never
   * sent to OpenRouter at all despite existing as stored config; confirmed
   * gap, fixed here. */
  temperature?: number;
  maxTokens?: number;
  provider?: OpenRouterProviderPrefs;
}): Promise<OpenRouterCompletionResult> {
  const body: Record<string, unknown> = {
    models: input.models,
    messages: input.messages,
  };
  if (input.tools.length > 0) body.tools = input.tools;
  if (input.temperature !== undefined) body.temperature = input.temperature;
  if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens;
  if (input.provider) body.provider = input.provider;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          lastError = new Error(`openrouter_${res.status}: ${text}`);
          await sleep(RETRY_BASE_MS * 2 ** attempt + Math.random() * 200);
          continue;
        }
        throw new Error(`openrouter_${res.status}: ${text}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message ?? null;

      return {
        message: message
          ? { role: message.role, content: message.content ?? null, tool_calls: message.tool_calls }
          : null,
        toolCalls: message?.tool_calls ?? [],
        // `usage.cost` is OpenRouter's own reported spend for this call when
        // present — preferred over any local per-token estimate. Ambiguity
        // flagged in the Motor de IA plan (#4): verify this field's exact
        // presence/shape against a real response; ai/quotas.ts's
        // ESTIMATED_COST_PER_TOKEN_USD is the fallback if it's ever absent.
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              costUsd: typeof data.usage.cost === "number" ? data.usage.cost : null,
            }
          : null,
        model: data.model ?? null,
      };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * 2 ** attempt + Math.random() * 200);
        continue;
      }
    }
  }

  console.error("[openrouter] request failed after retries:", lastError);
  throw lastError instanceof Error ? lastError : new Error("openrouter_request_failed");
}

const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Base de conocimiento (RAG) — confirmed via a live spike that this
 * endpoint exists and is reachable with the same auth/billing as chat
 * completions (a 402 "insufficient credits" response, not a 404), so no
 * second embeddings provider is needed. The exact response shape/dimension
 * (1536, matching text-embedding-3-small) is the standard for this model but
 * wasn't round-tripped against a real 200 response — the connected account
 * had zero credits during the spike.
 */
export async function embed(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openrouter_embed_${res.status}: ${text}`);
  }
  const data = await res.json();
  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error("openrouter_embed_unexpected_response");
  }
  return vector as number[];
}
