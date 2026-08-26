import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getOpenRouterCredentials, complete, type OpenRouterToolDef } from "@/lib/integrations/openrouter";
import { getAgentMetrics } from "./queries";
import {
  buildAgentFindings,
  type ToolCallStat,
  type ReferralStats,
  type ReferralStatus,
  type AgentFinding,
} from "./suggestionAnalysis";

/** Fase 11 (Análisis IA) — mismo criterio que advisorProfile.ts (Fase 9):
 * cálculo determinístico sobre datos REALES primero (suggestionAnalysis.ts),
 * la IA solo redacta texto encima. Nunca autoentrena: "aceptar" una
 * sugerencia siempre pasa por las Server Actions ya existentes
 * (updateAiAgentPersonality/toggleAgentTool/createAgentPromptVersion) desde
 * actions.ts, nunca un update crudo acá. */

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];
const MIN_CONVERSATIONS_TO_ANALYZE = 5;

export interface AgentSuggestion {
  id: string;
  kind: "strength" | "opportunity" | "pattern";
  field: "rules" | "tools" | "prompt" | null;
  title: string;
  body: string;
  proposedValue: Record<string, unknown> | null;
  status: "pending" | "accepted" | "rejected";
  reviewedAt: string | null;
  generatedAt: string;
}

function mapSuggestionRow(row: Record<string, unknown>): AgentSuggestion {
  return {
    id: row.id as string,
    kind: row.kind as AgentSuggestion["kind"],
    field: (row.field as AgentSuggestion["field"]) ?? null,
    title: row.title as string,
    body: row.body as string,
    proposedValue: (row.proposed_value as Record<string, unknown> | null) ?? null,
    status: row.status as AgentSuggestion["status"],
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    generatedAt: row.generated_at as string,
  };
}

/** Solo lectura del último batch generado — nunca dispara OpenRouter. La
 * pestaña llama esto al montar; el análisis se genera solo con el botón
 * "Generar sugerencias" (generateAgentSuggestions). */
export async function getCachedAgentSuggestions(workspaceId: string, agentId: string): Promise<AgentSuggestion[]> {
  const supabase = createServiceRoleClient();
  const { data: latest } = await supabase
    .from("ai_agent_suggestions")
    .select("generated_at")
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return [];

  const { data } = await supabase
    .from("ai_agent_suggestions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId)
    .eq("generated_at", latest.generated_at as string)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapSuggestionRow);
}

async function getAgentToolCallStats(workspaceId: string, agentId: string): Promise<ToolCallStat[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("tool_calls")
    .select("tool_id, status, latency_ms, tools(name)")
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId);

  const byTool = new Map<string, ToolCallStat>();
  for (const row of (data ?? []) as { tool_id: string; status: string; latency_ms: number | null; tools: { name: string } | { name: string }[] | null }[]) {
    const toolRow = Array.isArray(row.tools) ? row.tools[0] : row.tools;
    const entry = byTool.get(row.tool_id) ?? { toolId: row.tool_id, toolName: toolRow?.name ?? "—", totalCalls: 0, executedCount: 0, failedCount: 0, avgLatencyMs: null };
    entry.totalCalls += 1;
    if (row.status === "executed") entry.executedCount += 1;
    if (row.status === "failed" || row.status === "rejected") entry.failedCount += 1;
    byTool.set(row.tool_id, entry);
  }
  // Promedia latencia en una segunda pasada (evita cargar un acumulador float por fila).
  const latenciesByTool = new Map<string, number[]>();
  for (const row of (data ?? []) as { tool_id: string; latency_ms: number | null }[]) {
    if (row.latency_ms === null) continue;
    latenciesByTool.set(row.tool_id, [...(latenciesByTool.get(row.tool_id) ?? []), row.latency_ms]);
  }
  for (const [toolId, entry] of byTool) {
    const latencies = latenciesByTool.get(toolId) ?? [];
    entry.avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  }
  return [...byTool.values()];
}

/** Exportada además para el panel de estadísticas del detalle del agente
 * (AgentStatsPanel.tsx) — mismo criterio: sin advisor_id puntual no hay un
 * conjunto de referidos propio que medir. */
export async function getAgentReferralStats(workspaceId: string, advisorId: string | null): Promise<ReferralStats | null> {
  if (!advisorId) return null; // agente sin advisor_id (no es de módulo referrals, o atiende a todos) — sin un asesor puntual no hay un conjunto de referidos propio que medir
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("asesoria_referrals").select("status").eq("workspace_id", workspaceId).eq("advisor_id", advisorId);
  const rows = (data ?? []) as { status: ReferralStatus }[];
  const byStatus: Record<ReferralStatus, number> = { nuevo: 0, contactado: 0, interesado: 0, no_interesado: 0, convertido: 0 };
  for (const r of rows) byStatus[r.status] += 1;
  return { total: rows.length, byStatus };
}

const SUGGESTIONS_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "write_agent_suggestions",
    description: "Redacta el texto de cada sugerencia sobre un agente de IA a partir de hallazgos ya calculados.",
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              findingId: { type: "string", description: "El id del hallazgo que estás redactando, tal cual te lo pasé." },
              title: { type: "string", description: "Título corto, 5-10 palabras." },
              body: { type: "string", description: "1-3 oraciones explicando el hallazgo con los números reales que te pasé." },
              proposedValue: {
                type: "string",
                description:
                  "Solo si el hallazgo tiene field='rules' o field='prompt': el texto exacto a proponer (una regla nueva de una oración, o el prompt completo reescrito). Vacío/omitido para field='tools' o para strength/pattern.",
              },
            },
            required: ["findingId", "title", "body"],
          },
        },
      },
      required: ["suggestions"],
    },
  },
};

interface WrittenSuggestion {
  findingId: string;
  title: string;
  body: string;
  proposedValue?: string;
}

async function writeSuggestionsWithAI(apiKey: string, findings: AgentFinding[], currentSystemPrompt: string | null): Promise<Map<string, WrittenSuggestion>> {
  const context = findings
    .map((f) => `Hallazgo ${f.id} (tipo: ${f.kind}${f.field ? `, campo: ${f.field}` : ""}):\n${f.contextLines.join("\n")}`)
    .join("\n\n");
  const needsCurrentPrompt = findings.some((f) => f.field === "prompt");

  const result = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.4,
    tools: [SUGGESTIONS_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos un analista de agentes de IA para ventas por WhatsApp de un CRM de seguros. Te paso hallazgos YA CALCULADOS sobre el desempeño real de un agente (nunca recalcules ni inventes un número que no esté ahí) y para cada uno llamás a write_agent_suggestions con un título, un cuerpo de 1-3 oraciones y, si el hallazgo indica field='rules' o field='prompt', el texto exacto a proponer. Una regla nueva es UNA oración imperativa concreta. Un prompt reescrito debe ser el prompt COMPLETO (no un fragmento), coherente con el prompt actual que te paso si lo tenés, corrigiendo específicamente el problema del hallazgo. Tono profesional, en español.",
      },
      {
        role: "user",
        content: needsCurrentPrompt && currentSystemPrompt ? `${context}\n\nPrompt actual del agente:\n${currentSystemPrompt}` : context,
      },
    ],
  });

  const call = result.toolCalls[0];
  if (!call) return new Map();
  let parsed: { suggestions?: WrittenSuggestion[] };
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    parsed = { suggestions: [] };
  }
  return new Map((parsed.suggestions ?? []).map((s) => [s.findingId, s]));
}

function buildProposedValue(finding: AgentFinding, written: WrittenSuggestion | undefined): Record<string, unknown> | null {
  if (finding.field === "tools") {
    return { toolId: finding.toolId, toolName: finding.toolName, enabled: false };
  }
  if (finding.field === "rules" && written?.proposedValue) {
    return { newRule: written.proposedValue };
  }
  if (finding.field === "prompt" && written?.proposedValue) {
    return { systemPrompt: written.proposedValue };
  }
  return null;
}

/** Único punto de este archivo que llama OpenRouter. Gateado por el caller
 * (generateAgentSuggestionsAction en actions.ts, mismo requireManagerRole
 * que el resto de la configuración del agente). */
export async function generateAgentSuggestions(workspaceId: string, agentId: string): Promise<AgentSuggestion[]> {
  const supabase = createServiceRoleClient();

  const { data: agentRow } = await supabase.from("ai_agents").select("id, name, advisor_id").eq("id", agentId).eq("workspace_id", workspaceId).maybeSingle();
  if (!agentRow) throw new Error("Agente no encontrado en este workspace.");

  const metrics = await getAgentMetrics(workspaceId, agentId);
  if (metrics.conversationsHandled < MIN_CONVERSATIONS_TO_ANALYZE) {
    throw new Error(`Todavía no hay suficiente actividad real para analizar este agente (${metrics.conversationsHandled}/${MIN_CONVERSATIONS_TO_ANALYZE} conversaciones mínimas).`);
  }

  const [toolStats, referralStats] = await Promise.all([
    getAgentToolCallStats(workspaceId, agentId),
    getAgentReferralStats(workspaceId, (agentRow.advisor_id as string | null) ?? null),
  ]);
  const findings = buildAgentFindings(metrics, toolStats, referralStats);

  const credentials = await getOpenRouterCredentials(supabase, workspaceId);
  if (!credentials) throw new Error("Este workspace todavía no tiene una API Key de OpenRouter conectada (Perfil → Integraciones).");

  let cards: { kind: AgentFinding["kind"]; field: AgentFinding["field"]; title: string; body: string; proposedValue: Record<string, unknown> | null }[];

  if (findings.length === 0) {
    cards = [{ kind: "pattern", field: null, title: "Sin hallazgos por ahora", body: "El agente está funcionando dentro de parámetros normales — ninguna métrica muestra una diferencia significativa.", proposedValue: null }];
  } else {
    let currentSystemPrompt: string | null = null;
    if (findings.some((f) => f.field === "prompt")) {
      const { data: activePrompt } = await supabase.from("ai_prompts").select("system_prompt").eq("agent_id", agentId).eq("status", "active").maybeSingle();
      currentSystemPrompt = (activePrompt?.system_prompt as string | undefined) ?? null;
    }
    const written = await writeSuggestionsWithAI(credentials.apiKey, findings, currentSystemPrompt);
    cards = findings.map((f) => {
      const w = written.get(f.id);
      return {
        kind: f.kind,
        field: f.field,
        title: w?.title ?? f.id,
        body: w?.body ?? f.contextLines.join(" "),
        proposedValue: buildProposedValue(f, w),
      };
    });
  }

  const generatedAt = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("ai_agent_suggestions")
    .insert(
      cards.map((c) => ({
        workspace_id: workspaceId,
        agent_id: agentId,
        kind: c.kind,
        field: c.field,
        title: c.title,
        body: c.body,
        proposed_value: c.proposedValue,
        status: "pending",
        generated_at: generatedAt,
      })),
    )
    .select("*");
  if (error || !inserted) throw new Error("No se pudieron guardar las sugerencias.");

  return inserted.map(mapSuggestionRow);
}

export type ReviewDecision = "accept" | "reject";

export interface SuggestionForReview {
  id: string;
  agentId: string;
  field: AgentSuggestion["field"];
  proposedValue: Record<string, unknown> | null;
}

/** Solo resuelve la fila + valida pertenencia — la aplicación real del
 * cambio (llamar a updateAiAgentPersonality/toggleAgentTool/
 * createAgentPromptVersion) vive en actions.ts, que ya tiene el gate
 * owner/admin y las Server Actions reales a reusar. */
export async function getSuggestionForReview(workspaceId: string, suggestionId: string): Promise<SuggestionForReview | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("ai_agent_suggestions").select("id, agent_id, field, proposed_value, status").eq("id", suggestionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data || data.status !== "pending") return null;
  return { id: data.id as string, agentId: data.agent_id as string, field: data.field as AgentSuggestion["field"], proposedValue: (data.proposed_value as Record<string, unknown> | null) ?? null };
}

export async function markSuggestionReviewed(suggestionId: string, decision: ReviewDecision, reviewedBy: string | null): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("ai_agent_suggestions")
    .update({ status: decision === "accept" ? "accepted" : "rejected", reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", suggestionId);
}
