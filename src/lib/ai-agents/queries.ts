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

/** Fase 5 — mismo patrón que BusinessHoursConfig: jsonb con shape fijo,
 * validado en la app, no en la DB. */
export interface AgentPersonality {
  formality: "baja" | "media" | "alta";
  warmth: "baja" | "media" | "alta";
  directness: "directo" | "equilibrado" | "indirecto";
  emojiUsage: "ninguno" | "bajo" | "medio" | "alto";
  messageLength: "cortos" | "medios" | "largos";
  questioningStyle: "poco" | "moderado" | "frecuente";
  persuasiveness: "baja" | "media" | "alta";
}

export const DEFAULT_AGENT_PERSONALITY: AgentPersonality = {
  formality: "media",
  warmth: "alta",
  directness: "equilibrado",
  emojiUsage: "bajo",
  messageLength: "cortos",
  questioningStyle: "frecuente",
  persuasiveness: "media",
};

export type AiAgentType = "referrals" | "citas" | "seguimiento";

export interface AiAgentListItem {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  moduleKey: string;
  channels: string[];
  model: string;
  responseMode: ResponseMode;
  /** Solo tiene sentido para moduleKey==='referrals' (Fase 4) — null = el
   * agente atiende todos los referidos del workspace. */
  advisorId: string | null;
  /** "Tipo" elegido en el wizard (/agentes-ia/nuevo) — solo para display
   * (ícono/badge), nunca cambia el motor. null = agente creado antes de
   * este campo, o vía el modal simple (ATS) — se muestra el módulo real
   * en su lugar, nunca un tipo inventado. */
  agentType: AiAgentType | null;
}

export interface AiAgentDetail extends AiAgentListItem {
  temperature: number;
  maxTokens: number;
  businessHours: BusinessHoursConfig;
  workspaceId: string;
  createdAt: string;
  personality: AgentPersonality;
  rules: string[];
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
    advisorId: (row.advisor_id as string | null) ?? null,
    agentType: (row.agent_type as AiAgentType | null) ?? null,
    temperature: Number(row.temperature ?? 0.7),
    maxTokens: Number(row.max_tokens ?? 1024),
    businessHours: row.business_hours as BusinessHoursConfig,
    workspaceId: row.workspace_id as string,
    createdAt: row.created_at as string,
    personality: (row.personality as AgentPersonality) ?? DEFAULT_AGENT_PERSONALITY,
    rules: (row.rules as string[]) ?? [],
  };
}

const AGENT_COLUMNS =
  "id, name, description, status, module_key, channels, model, response_mode, temperature, max_tokens, business_hours, workspace_id, created_at, advisor_id, agent_type, personality, rules";

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

export interface AgentAdvisorInfo {
  fullName: string;
  avatarUrl: string | null;
  email: string;
  role: string;
}

/** Mismo patrón que getAsesoriaList (asesorias/queries.ts): un round-trip a
 * la RPC workspace_member_names para resolver nombre/avatar/email — no hay
 * teléfono unido a workspace_members en ningún lado del esquema, así que no
 * se pide/muestra acá. */
export async function getAgentAdvisorInfo(workspaceId: string, advisorId: string | null): Promise<AgentAdvisorInfo | null> {
  if (!advisorId) return null;
  const supabase = await createClient();
  const [{ data: memberNames }, { data: memberRow }] = await Promise.all([
    supabase.rpc("workspace_member_names", { ws_id: workspaceId }),
    supabase.from("workspace_members").select("role").eq("id", advisorId).maybeSingle(),
  ]);
  const match = (memberNames ?? []).find((m: { member_id: string }) => m.member_id === advisorId) as
    | { member_id: string; full_name: string; email: string; avatar_url: string | null }
    | undefined;
  if (!match) return null;
  return { fullName: match.full_name, avatarUrl: match.avatar_url ?? null, email: match.email, role: (memberRow?.role as string) ?? "member" };
}

export interface AgentReferralActivityStats {
  conversacionesActivas: number;
  mensajesEnviados: number;
  respuestasRecibidas: number;
  tasaRespuestaPct: number | null;
  citasGeneradas: number;
  conversionACitaPct: number | null;
  seguimientosRealizados: number;
}

const ACTIVITY_WINDOW_DAYS = 14; // mismo período que getAgentMetrics, para que ambos paneles muestren números consistentes entre sí

/** "Mensajes enviados"/"Respuestas recibidas" son una aproximación real (no
 * inventada): `messages` no tiene agent_id (ver comentario en
 * getAgentMetrics), así que se cuentan los mensajes dentro de las
 * conversation_id que usage_events ya vincula a este agente — el mismo join
 * que ya usa conversationsHandled. "Citas generadas" viene de `bookings`
 * (creada por el tool create_appointment) para los contactos de los
 * referidos de este asesor. "Seguimientos realizados" cuenta
 * referral_followups en status='sent' para esos mismos referidos. */
export async function getAgentReferralActivityStats(workspaceId: string, agent: AiAgentDetail): Promise<AgentReferralActivityStats | null> {
  if (agent.moduleKey !== "referrals" || !agent.advisorId) return null;
  const supabase = await createClient();
  const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: usageRows }, { data: referralRows }] = await Promise.all([
    supabase
      .from("usage_events")
      .select("conversation_id")
      .eq("workspace_id", workspaceId)
      .eq("agent_id", agent.id)
      .eq("is_sandbox", false)
      .gte("created_at", since),
    supabase.from("asesoria_referrals").select("id, referred_contact_id").eq("workspace_id", workspaceId).eq("advisor_id", agent.advisorId),
  ]);

  const conversationIds = [...new Set((usageRows ?? []).map((r) => r.conversation_id as string).filter(Boolean))];
  const referralIds = (referralRows ?? []).map((r) => r.id as string);
  const contactIds = [...new Set((referralRows ?? []).map((r) => r.referred_contact_id as string | null).filter((id): id is string => Boolean(id)))];

  let conversacionesActivas = 0;
  let mensajesEnviados = 0;
  let respuestasRecibidas = 0;
  if (conversationIds.length) {
    const [{ data: convRows }, { count: outboundCount }, { count: inboundCount }] = await Promise.all([
      supabase.from("conversations").select("id, status").in("id", conversationIds),
      supabase.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", conversationIds).eq("direction", "outbound"),
      supabase.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", conversationIds).eq("direction", "inbound"),
    ]);
    conversacionesActivas = (convRows ?? []).filter((c) => c.status !== "closed").length;
    mensajesEnviados = outboundCount ?? 0;
    respuestasRecibidas = inboundCount ?? 0;
  }

  let citasGeneradas = 0;
  if (contactIds.length) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("contact_id", contactIds)
      .gte("created_at", since);
    citasGeneradas = count ?? 0;
  }

  let seguimientosRealizados = 0;
  if (referralIds.length) {
    const { count } = await supabase.from("referral_followups").select("id", { count: "exact", head: true }).in("referral_id", referralIds).eq("status", "sent");
    seguimientosRealizados = count ?? 0;
  }

  return {
    conversacionesActivas,
    mensajesEnviados,
    respuestasRecibidas,
    tasaRespuestaPct: mensajesEnviados > 0 ? Math.round((respuestasRecibidas / mensajesEnviados) * 100) : null,
    citasGeneradas,
    conversionACitaPct: referralIds.length > 0 ? Math.round((citasGeneradas / referralIds.length) * 100) : null,
    seguimientosRealizados,
  };
}

export interface AgentFollowupRow {
  id: string;
  referralName: string;
  referralPhone: string;
  attemptNumber: number;
  scheduledAt: string;
  status: "pending" | "sent" | "cancelled";
  cancelledReason: string | null;
}

/** Sin UI propia hoy (confirmado — ninguna pantalla lista referral_followups
 * todavía). Solo lectura: el cron (api/cron/referral-followups) es el único
 * que las despacha, acá no se agrega ninguna acción de escritura. */
export async function getAgentFollowups(workspaceId: string, advisorId: string | null): Promise<AgentFollowupRow[]> {
  if (!advisorId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("referral_followups")
    .select("id, attempt_number, scheduled_at, status, cancelled_reason, asesoria_referrals!inner(name, phone, advisor_id)")
    .eq("workspace_id", workspaceId)
    .eq("asesoria_referrals.advisor_id", advisorId)
    .order("scheduled_at", { ascending: false });

  return (data ?? []).map((r) => {
    const referral = r.asesoria_referrals as unknown as { name: string; phone: string };
    return {
      id: r.id as string,
      referralName: referral.name,
      referralPhone: referral.phone,
      attemptNumber: r.attempt_number as number,
      scheduledAt: r.scheduled_at as string,
      status: r.status as AgentFollowupRow["status"],
      cancelledReason: (r.cancelled_reason as string | null) ?? null,
    };
  });
}

export interface AgentListStats {
  conversationsHandled: number;
  citasGeneradas: number;
  citasProgramadas: number;
  /** null = agente sin advisor_id (no tiene un conjunto de referidos propio
   * que medir — mismo criterio que getAgentReferralStats, suggestions.ts). */
  referidosGestionados: number | null;
  seguimientosPendientes: number | null;
  lastActivityAt: string | null;
}

const LIST_STATS_WINDOW_DAYS = 7;

/** Versión en LOTE (no N+1) de las estadísticas por agente para la grilla
 * de /agentes-ia — a diferencia de getAgentReferralActivityStats (detalle
 * de un agente puntual, gateada a moduleKey==='referrals'), esta corre para
 * TODOS los agentes de la lista en un puñado fijo de queries, y calcula
 * conversaciones/citas para CUALQUIER módulo (no solo referidos) uniendo
 * usage_events → conversations → contact_id → bookings. */
export async function getAiAgentListStats(
  workspaceId: string,
  agents: { id: string; advisorId: string | null }[],
): Promise<Map<string, AgentListStats>> {
  const stats = new Map<string, AgentListStats>();
  for (const a of agents) {
    stats.set(a.id, { conversationsHandled: 0, citasGeneradas: 0, citasProgramadas: 0, referidosGestionados: null, seguimientosPendientes: null, lastActivityAt: null });
  }
  if (agents.length === 0) return stats;

  const supabase = await createClient();
  const agentIds = agents.map((a) => a.id);
  const since = new Date(Date.now() - LIST_STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: usageRows } = await supabase
    .from("usage_events")
    .select("agent_id, conversation_id, created_at")
    .eq("workspace_id", workspaceId)
    .in("agent_id", agentIds)
    .eq("is_sandbox", false)
    .gte("created_at", since);

  const conversationIdsByAgent = new Map<string, Set<string>>();
  const allConversationIds = new Set<string>();
  for (const row of usageRows ?? []) {
    const agentId = row.agent_id as string;
    const conversationId = row.conversation_id as string;
    const createdAt = row.created_at as string;
    const entry = stats.get(agentId);
    if (!entry) continue;
    if (!entry.lastActivityAt || createdAt > entry.lastActivityAt) entry.lastActivityAt = createdAt;
    if (!conversationIdsByAgent.has(agentId)) conversationIdsByAgent.set(agentId, new Set());
    conversationIdsByAgent.get(agentId)!.add(conversationId);
    allConversationIds.add(conversationId);
  }
  for (const [agentId, convSet] of conversationIdsByAgent) {
    stats.get(agentId)!.conversationsHandled = convSet.size;
  }

  let contactIdByConversation = new Map<string, string>();
  if (allConversationIds.size > 0) {
    const { data: convRows } = await supabase.from("conversations").select("id, contact_id").in("id", [...allConversationIds]);
    contactIdByConversation = new Map((convRows ?? []).map((r) => [r.id as string, r.contact_id as string]));
  }

  const agentIdsByContact = new Map<string, Set<string>>();
  for (const [agentId, convSet] of conversationIdsByAgent) {
    for (const convId of convSet) {
      const contactId = contactIdByConversation.get(convId);
      if (!contactId) continue;
      if (!agentIdsByContact.has(contactId)) agentIdsByContact.set(contactId, new Set());
      agentIdsByContact.get(contactId)!.add(agentId);
    }
  }
  const allContactIds = [...agentIdsByContact.keys()];

  if (allContactIds.length > 0) {
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("contact_id, status, created_at")
      .eq("workspace_id", workspaceId)
      .in("contact_id", allContactIds);
    for (const b of bookingRows ?? []) {
      const contactId = b.contact_id as string;
      const owningAgents = agentIdsByContact.get(contactId);
      if (!owningAgents) continue;
      for (const agentId of owningAgents) {
        const entry = stats.get(agentId);
        if (!entry) continue;
        if ((b.created_at as string) >= since) entry.citasGeneradas += 1;
        if (b.status === "scheduled") entry.citasProgramadas += 1;
      }
    }
  }

  const advisorAgents = agents.filter((a): a is { id: string; advisorId: string } => Boolean(a.advisorId));
  if (advisorAgents.length > 0) {
    const advisorIds = [...new Set(advisorAgents.map((a) => a.advisorId))];
    const { data: referralRows } = await supabase
      .from("asesoria_referrals")
      .select("id, advisor_id")
      .eq("workspace_id", workspaceId)
      .in("advisor_id", advisorIds);

    const referralIdsByAdvisor = new Map<string, string[]>();
    const countByAdvisor = new Map<string, number>();
    for (const r of referralRows ?? []) {
      const advisorId = r.advisor_id as string;
      countByAdvisor.set(advisorId, (countByAdvisor.get(advisorId) ?? 0) + 1);
      if (!referralIdsByAdvisor.has(advisorId)) referralIdsByAdvisor.set(advisorId, []);
      referralIdsByAdvisor.get(advisorId)!.push(r.id as string);
    }
    for (const a of advisorAgents) {
      stats.get(a.id)!.referidosGestionados = countByAdvisor.get(a.advisorId) ?? 0;
    }

    const allReferralIds = [...referralIdsByAdvisor.values()].flat();
    const referralToAdvisor = new Map<string, string>();
    for (const [advisorId, ids] of referralIdsByAdvisor) for (const id of ids) referralToAdvisor.set(id, advisorId);

    const pendingByAdvisor = new Map<string, number>();
    if (allReferralIds.length > 0) {
      const { data: followupRows } = await supabase.from("referral_followups").select("referral_id").in("referral_id", allReferralIds).eq("status", "pending");
      for (const f of followupRows ?? []) {
        const advisorId = referralToAdvisor.get(f.referral_id as string);
        if (!advisorId) continue;
        pendingByAdvisor.set(advisorId, (pendingByAdvisor.get(advisorId) ?? 0) + 1);
      }
    }
    for (const a of advisorAgents) {
      stats.get(a.id)!.seguimientosPendientes = pendingByAdvisor.get(a.advisorId) ?? 0;
    }
  }

  return stats;
}
