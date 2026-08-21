"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { resolveOpenRouterApiKey, complete, type OpenRouterToolDef, type OpenRouterCompletionResult } from "@/lib/integrations/openrouter";
import { isQuotaExceeded, estimateCostUsd } from "@/lib/ai/quotas";
import { getConversationDetail } from "@/lib/inbox/queries";
import { getConversationAiInsight, type ConversationAiInsight, type ConversationLeadAnalysis, type ConversationExtractedInfo } from "./queries";

const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

/** Mismo criterio que requireAgencyAccessOrError (kpis/aiManager/actions.ts)
 * — nunca throw, un Error cruzando el límite de un Server Action puede
 * llegar al cliente como un "Server Components render" genérico (bug ya
 * documentado en openrouter.ts). */
type AccessResult = { ok: true; workspaceId: string } | { ok: false; error: string };

async function requireWorkspaceOrError(): Promise<AccessResult> {
  const { workspaceId } = await requireActiveWorkspace();
  return { ok: true, workspaceId };
}

/** Contexto compartido por las 4 acciones que llaman al LLM — mismo tipo de
 * datos que arma buildContext() en agentRuntime.ts (contacto/tags/mensajes
 * recientes), pero sin el resto de la maquinaria de agente (RAG, prompts
 * custom, herramientas) — acá es una sola llamada puntual, no un turno de
 * agente. Los últimos 20 mensajes reales (nunca drafts/rechazados). */
async function buildConversationContext(workspaceId: string, conversationId: string) {
  const detail = await getConversationDetail(workspaceId, conversationId);
  if (!detail) return null;

  const realMessages = detail.messages.filter((m) => m.status !== "draft" && m.status !== "rejected").slice(-20);
  const transcript = realMessages.map((m) => `${m.direction === "inbound" ? "Lead" : "Agente"}: ${m.body}`).join("\n");

  const contactLines = [
    `Nombre: ${detail.contact.name}`,
    detail.contact.company ? `Empresa: ${detail.contact.company}` : null,
    detail.contact.jobTitle ? `Cargo: ${detail.contact.jobTitle}` : null,
    detail.tags.length > 0 ? `Etiquetas: ${detail.tags.map((t) => t.name).join(", ")}` : null,
    detail.notes.length > 0 ? `Notas internas: ${detail.notes.map((n) => n.body).join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { detail, transcript, contactLines };
}

/** Resuelve la key + chequea presupuesto mensual — isQuotaExceeded existe
 * hace rato (src/lib/ai/quotas.ts) pero ninguna acción manual de IA lo usaba
 * todavía (solo el Agent Runtime automático) — el Inbox es justo el tipo de
 * superficie de alta frecuencia que más lo necesita. */
async function resolveKeyWithQuota(serviceClient: ReturnType<typeof createServiceRoleClient>, workspaceId: string, featureLabel: string): Promise<{ ok: true; apiKey: string } | { ok: false; error: string }> {
  if (await isQuotaExceeded(serviceClient, workspaceId)) {
    return { ok: false, error: "Se alcanzó el presupuesto mensual de IA de este workspace. Contactá a un admin para ajustarlo." };
  }
  return resolveOpenRouterApiKey(serviceClient, workspaceId, featureLabel);
}

async function recordUsage(serviceClient: ReturnType<typeof createServiceRoleClient>, workspaceId: string, conversationId: string, result: OpenRouterCompletionResult, latencyMs: number) {
  const tokensIn = result.usage?.promptTokens ?? 0;
  const tokensOut = result.usage?.completionTokens ?? 0;
  if (tokensIn === 0 && tokensOut === 0) return;
  const costUsd = result.usage?.costUsd ?? estimateCostUsd(tokensIn, tokensOut);
  await serviceClient.from("usage_events").insert({
    workspace_id: workspaceId,
    agent_id: null,
    conversation_id: conversationId,
    provider: "openrouter",
    model: result.model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    latency_ms: latencyMs,
    is_sandbox: false,
  });
}

export type ConversationAiInsightResult = { ok: true; insight: ConversationAiInsight } | { ok: false; error: string };

/** Solo lectura del caché — NUNCA dispara una llamada a OpenRouter. */
export async function getConversationAiInsightAction(conversationId: string): Promise<ConversationAiInsightResult> {
  const access = await requireWorkspaceOrError();
  if (!access.ok) return access;
  const insight = await getConversationAiInsight(access.workspaceId, conversationId);
  return { ok: true, insight };
}

/** "Generar respuesta" — no existía ningún punto de entrada on-demand antes
 * de esto (el pipeline de IA automático, agentRuntime.ts, solo corre desde
 * el flush del Buffer Inteligente). Inserta un mensaje status:'draft' —
 * misma fila/UI de aprobar-editar-rechazar que ya renderiza
 * ConversationThread.tsx para los drafts automáticos, sin tocar esa UI. */
export async function generateReplyDraftAction(conversationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireWorkspaceOrError();
  if (!access.ok) return access;

  const serviceClient = createServiceRoleClient();
  const key = await resolveKeyWithQuota(serviceClient, access.workspaceId, "generar una respuesta sugerida");
  if (!key.ok) return key;

  const ctx = await buildConversationContext(access.workspaceId, conversationId);
  if (!ctx) return { ok: false, error: "conversation_not_found" };

  const startedAt = Date.now();
  const result = await complete({
    apiKey: key.apiKey,
    models: MODEL_CHAIN,
    temperature: 0.5,
    tools: [],
    messages: [
      {
        role: "system",
        content:
          "Sos un asistente de ventas de una agencia de seguros, respondiendo por WhatsApp. Leé la conversación y escribí UNA respuesta breve, natural y profesional para el próximo mensaje del agente — nunca inventes datos que no estén en la conversación (precios, fechas, promesas). Respondé solo con el texto del mensaje, sin comillas ni explicación.",
      },
      { role: "user", content: `Datos del contacto:\n${ctx.contactLines}\n\nConversación:\n${ctx.transcript}` },
    ],
  });
  await recordUsage(serviceClient, access.workspaceId, conversationId, result, Date.now() - startedAt);

  const body = result.message?.content?.trim();
  if (!body) return { ok: false, error: "El modelo no devolvió una respuesta." };

  const { error } = await serviceClient.from("messages").insert({
    workspace_id: access.workspaceId,
    conversation_id: conversationId,
    direction: "outbound",
    sender_type: "ai",
    sender_id: null,
    type: "text",
    content: { body },
    status: "draft",
  });
  if (error) return { ok: false, error: "No se pudo guardar la sugerencia." };

  revalidatePath("/inbox");
  return { ok: true };
}

const LEAD_ANALYSIS_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "analyze_lead",
    description: "Analiza el nivel de interés y avance de un lead a partir de una conversación de WhatsApp.",
    parameters: {
      type: "object",
      properties: {
        intencion: { type: ["string", "null"], description: "Qué está buscando el lead, en pocas palabras. Null si no es claro." },
        interes: { type: ["string", "null"], enum: ["alto", "medio", "bajo", null], description: "Nivel de interés mostrado." },
        necesidad: { type: ["string", "null"], description: "Necesidad concreta detectada (ej. 'seguro de vida para su familia'). Null si no se mencionó." },
        objeciones: { type: "array", items: { type: "string" }, description: "Objeciones o dudas que planteó el lead. Vacío si ninguna." },
        probabilidad: { type: ["string", "null"], enum: ["alta", "media", "baja", null], description: "Probabilidad de que avance a la próxima etapa." },
      },
      required: ["objeciones"],
    },
  },
};

export type AnalyzeLeadResult = { ok: true; analysis: ConversationLeadAnalysis } | { ok: false; error: string };

/** "Analizar lead" — patrón de extracción estructurada por tool-calling
 * idéntico a extractContractDataWithAI (src/lib/clients/contractExtraction.ts). */
export async function analyzeLeadAction(conversationId: string): Promise<AnalyzeLeadResult> {
  const access = await requireWorkspaceOrError();
  if (!access.ok) return access;

  const serviceClient = createServiceRoleClient();
  const key = await resolveKeyWithQuota(serviceClient, access.workspaceId, "analizar este lead");
  if (!key.ok) return key;

  const ctx = await buildConversationContext(access.workspaceId, conversationId);
  if (!ctx) return { ok: false, error: "conversation_not_found" };

  const startedAt = Date.now();
  const result = await complete({
    apiKey: key.apiKey,
    models: MODEL_CHAIN,
    temperature: 0,
    tools: [LEAD_ANALYSIS_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos un analista de ventas. Leé la conversación y llamá a analyze_lead con tu análisis honesto — si algo no se puede determinar de la conversación, dejalo en null. Nunca inventes información que no esté ahí.",
      },
      { role: "user", content: `Datos del contacto:\n${ctx.contactLines}\n\nConversación:\n${ctx.transcript}` },
    ],
  });
  await recordUsage(serviceClient, access.workspaceId, conversationId, result, Date.now() - startedAt);

  const call = result.toolCalls[0];
  if (!call) return { ok: false, error: "El modelo no devolvió un análisis." };

  let parsed: Partial<ConversationLeadAnalysis>;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    return { ok: false, error: "No se pudo interpretar la respuesta de la IA." };
  }

  const analysis: ConversationLeadAnalysis = {
    intencion: parsed.intencion ?? null,
    interes: parsed.interes ?? null,
    necesidad: parsed.necesidad ?? null,
    objeciones: parsed.objeciones ?? [],
    probabilidad: parsed.probabilidad ?? null,
  };

  await serviceClient
    .from("conversation_ai_insights")
    .upsert({ workspace_id: access.workspaceId, conversation_id: conversationId, lead_analysis: analysis, generated_at: new Date().toISOString() }, { onConflict: "conversation_id" });

  revalidatePath("/inbox");
  return { ok: true, analysis };
}

const EXTRACT_INFO_TOOL: OpenRouterToolDef = {
  type: "function",
  function: {
    name: "extract_lead_info",
    description: "Extrae datos estructurados mencionados por el lead durante la conversación.",
    parameters: {
      type: "object",
      properties: {
        empresa: { type: ["string", "null"], description: "Empresa donde trabaja el lead, si la mencionó." },
        cargo: { type: ["string", "null"], description: "Cargo o puesto del lead, si lo mencionó." },
        ciudad: { type: ["string", "null"], description: "Ciudad donde vive el lead, si la mencionó." },
        necesidad: { type: ["string", "null"], description: "Necesidad o producto de interés mencionado." },
        presupuesto: { type: ["string", "null"], description: "Presupuesto o rango de precio mencionado, tal cual lo dijo." },
      },
      required: [],
    },
  },
};

export type ExtractLeadInfoResult = { ok: true; info: ConversationExtractedInfo } | { ok: false; error: string };

/** "Extraer información" — mismo patrón de tool-calling que analyzeLeadAction.
 * Todos los campos nullable: un dato no mencionado en la conversación queda
 * null, nunca se inventa. */
export async function extractLeadInfoAction(conversationId: string): Promise<ExtractLeadInfoResult> {
  const access = await requireWorkspaceOrError();
  if (!access.ok) return access;

  const serviceClient = createServiceRoleClient();
  const key = await resolveKeyWithQuota(serviceClient, access.workspaceId, "extraer información del lead");
  if (!key.ok) return key;

  const ctx = await buildConversationContext(access.workspaceId, conversationId);
  if (!ctx) return { ok: false, error: "conversation_not_found" };

  const startedAt = Date.now();
  const result = await complete({
    apiKey: key.apiKey,
    models: MODEL_CHAIN,
    temperature: 0,
    tools: [EXTRACT_INFO_TOOL],
    messages: [
      {
        role: "system",
        content:
          "Sos un asistente que extrae datos mencionados explícitamente en una conversación de WhatsApp. Llamá a extract_lead_info. Si un dato no fue mencionado, dejalo en null — nunca lo inventes ni lo infieras de forma forzada.",
      },
      { role: "user", content: `Conversación:\n${ctx.transcript}` },
    ],
  });
  await recordUsage(serviceClient, access.workspaceId, conversationId, result, Date.now() - startedAt);

  const call = result.toolCalls[0];
  if (!call) return { ok: false, error: "El modelo no devolvió datos." };

  let parsed: Partial<ConversationExtractedInfo>;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch {
    return { ok: false, error: "No se pudo interpretar la respuesta de la IA." };
  }

  const info: ConversationExtractedInfo = {
    empresa: parsed.empresa ?? null,
    cargo: parsed.cargo ?? null,
    ciudad: parsed.ciudad ?? null,
    necesidad: parsed.necesidad ?? null,
    presupuesto: parsed.presupuesto ?? null,
  };

  await serviceClient
    .from("conversation_ai_insights")
    .upsert({ workspace_id: access.workspaceId, conversation_id: conversationId, extracted_info: info, generated_at: new Date().toISOString() }, { onConflict: "conversation_id" });

  revalidatePath("/inbox");
  return { ok: true, info };
}

export type SummaryResult = { ok: true; summary: string; nextStep: string } | { ok: false; error: string };

/** "Resumir conversación" — alimenta TANTO el botón del popover COMO la
 * card discreta "Resumen IA" arriba del historial (misma llamada, mismo
 * caché). "Siguiente acción" no dispara una llamada aparte: es el mismo
 * `nextStep` que devuelve esta única función — evita una llamada extra a
 * costo por algo que ya sale de acá. */
export async function generateConversationSummaryAction(conversationId: string): Promise<SummaryResult> {
  const access = await requireWorkspaceOrError();
  if (!access.ok) return access;

  const serviceClient = createServiceRoleClient();
  const key = await resolveKeyWithQuota(serviceClient, access.workspaceId, "resumir esta conversación");
  if (!key.ok) return key;

  const ctx = await buildConversationContext(access.workspaceId, conversationId);
  if (!ctx) return { ok: false, error: "conversation_not_found" };
  if (!ctx.transcript.trim()) return { ok: false, error: "Todavía no hay mensajes en esta conversación." };

  const startedAt = Date.now();
  const result = await complete({
    apiKey: key.apiKey,
    models: MODEL_CHAIN,
    temperature: 0.3,
    tools: [],
    messages: [
      {
        role: "system",
        content:
          'Sos un asistente de ventas. Leé la conversación y respondé EXACTAMENTE en este formato de 2 líneas, sin nada más:\nResumen: <1-2 oraciones resumiendo la conversación y el interés del lead>\nPróximo paso: <una recomendación concreta de qué hacer ahora>',
      },
      { role: "user", content: `Datos del contacto:\n${ctx.contactLines}\n\nConversación:\n${ctx.transcript}` },
    ],
  });
  await recordUsage(serviceClient, access.workspaceId, conversationId, result, Date.now() - startedAt);

  const text = result.message?.content?.trim() ?? "";
  const summaryMatch = text.match(/Resumen:\s*(.+)/);
  const nextStepMatch = text.match(/Próximo paso:\s*(.+)/);
  const summary = summaryMatch?.[1]?.trim() ?? text;
  const nextStep = nextStepMatch?.[1]?.trim() ?? "";
  if (!summary) return { ok: false, error: "El modelo no devolvió un resumen." };

  await serviceClient
    .from("conversation_ai_insights")
    .upsert({ workspace_id: access.workspaceId, conversation_id: conversationId, summary, next_step: nextStep || null, generated_at: new Date().toISOString() }, { onConflict: "conversation_id" });

  revalidatePath("/inbox");
  return { ok: true, summary, nextStep };
}
