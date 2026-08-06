"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { resolveOpenRouterApiKey, complete, type OpenRouterKeyResult } from "@/lib/integrations/openrouter";
import { runAssistantTurn, narrateToolResult, type AssistantTurnResult } from "@/lib/assistant/runtime";
import { ASSISTANT_TOOL_BY_KEY } from "@/lib/assistant/tools/registry";
import type { AssistantToolContext } from "@/lib/assistant/tools/shared";
import { getTodaySummaryCard, getPriorityItems, getCrossSellCandidates, getWeeklyPerformance, getUpcomingMeetings, getAlerts } from "@/lib/assistant/queries";

function revalidateAssistant() {
  revalidatePath("/asistente");
}

/** Ver la nota en resolveOpenRouterApiKey (openrouter.ts) — devuelve el
 * error como dato en vez de lanzar, porque un throw acá no llegaba de
 * forma confiable al catch del cliente en producción (causa real del bug
 * "funciona para el owner pero no para agentes": cada agente tiene su
 * propio workspace recién creado, sin OpenRouter conectado todavía). */
async function requireApiKey(workspaceId: string): Promise<OpenRouterKeyResult> {
  const service = createServiceRoleClient();
  return resolveOpenRouterApiKey(service, workspaceId, "usar el Asistente IA");
}

export interface AssistantMessageView {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  pendingToolCallIds: string[];
  createdAt: string;
}

export interface AssistantToolCallView {
  id: string;
  toolKey: string;
  toolLabel: string;
  arguments: Record<string, unknown>;
  status: string;
}

/** Una sola conversación activa por miembro (mismo criterio que un chat de
 * copiloto — no hay una lista de "chats" separados en la Fase 1, aunque la
 * tabla ya soporta varias si hiciera falta más adelante). */
export async function getOrCreateActiveConversationAction(): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) throw new Error("No se pudo resolver tu usuario en este workspace.");
  const supabase = await createClient();

  const { data: existing } = await supabase.from("assistant_conversations").select("id").eq("workspace_id", workspaceId).eq("member_id", memberId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return { id: existing.id as string };

  const { data: created, error } = await supabase.from("assistant_conversations").insert({ workspace_id: workspaceId, member_id: memberId }).select("id").single();
  if (error || !created) throw new Error("No se pudo iniciar la conversación.");
  return { id: created.id as string };
}

export async function getConversationMessagesAction(conversationId: string): Promise<AssistantMessageView[]> {
  await requireActiveWorkspace();
  const supabase = await createClient();
  const { data } = await supabase.from("assistant_messages").select("id, role, content, pending_tool_call_ids, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  return ((data ?? []) as { id: string; role: string; content: string | null; pending_tool_call_ids: string[]; created_at: string }[]).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "tool",
    content: m.content,
    pendingToolCallIds: m.pending_tool_call_ids ?? [],
    createdAt: m.created_at,
  }));
}

export async function getPendingToolCallsAction(toolCallIds: string[]): Promise<AssistantToolCallView[]> {
  if (toolCallIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("assistant_tool_calls").select("id, tool_key, arguments, status").in("id", toolCallIds);
  return ((data ?? []) as { id: string; tool_key: string; arguments: Record<string, unknown>; status: string }[]).map((t) => ({
    id: t.id,
    toolKey: t.tool_key,
    toolLabel: ASSISTANT_TOOL_BY_KEY.get(t.tool_key)?.description ?? t.tool_key,
    arguments: t.arguments,
    status: t.status,
  }));
}

export async function sendAssistantMessageAction(conversationId: string, text: string): Promise<AssistantTurnResult | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return { error: "No se pudo resolver tu usuario en este workspace." };
  if (!text.trim()) return { error: "Escribí un mensaje." };

  const credentials = await requireApiKey(workspaceId);
  if (!credentials.ok) return { error: credentials.error };
  const apiKey = credentials.apiKey;
  const supabase = await createClient();

  const { data: conversation } = await supabase.from("assistant_conversations").select("id").eq("id", conversationId).eq("workspace_id", workspaceId).eq("member_id", memberId).maybeSingle();
  if (!conversation) return { error: "Conversación no encontrada." };

  const result = await runAssistantTurn({ supabase, workspaceId, memberId, conversationId, apiKey, userText: text.trim() });
  revalidateAssistant();
  return result;
}

/** El usuario tocó "Confirmar" en la tarjeta de una acción propuesta — recién
 * acá se ejecuta el handler de verdad (nunca durante el turno del modelo).
 *
 * La ejecución del handler y la narración del resultado están en try/catch
 * separados a propósito: si la acción real (crear tarea, registrar un
 * pago, etc.) ya se ejecutó bien pero la narración con IA falla después
 * (ej. sin OpenRouter conectado), el usuario tiene que enterarse de que SÍ
 * se hizo — no reportar "no pude completarlo" sobre algo que ya pasó. */
export async function confirmToolCallAction(toolCallId: string): Promise<{ reply: string } | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return { error: "No se pudo resolver tu usuario en este workspace." };
  const supabase = await createClient();

  const { data: row } = await supabase.from("assistant_tool_calls").select("*").eq("id", toolCallId).eq("workspace_id", workspaceId).eq("member_id", memberId).maybeSingle();
  if (!row) return { error: "Acción no encontrada." };
  if (row.status !== "proposed") return { error: "Esta acción ya se resolvió." };

  const toolDef = ASSISTANT_TOOL_BY_KEY.get(row.tool_key as string);
  if (!toolDef) return { error: "Herramienta desconocida." };

  await supabase.from("assistant_tool_calls").update({ status: "confirmed" }).eq("id", toolCallId);

  const toolCtx: AssistantToolContext = { supabase, workspaceId, memberId };
  const args = (row.arguments as Record<string, unknown>) ?? {};

  let result: unknown;
  try {
    result = await toolDef.handler(args, toolCtx);
    await supabase.from("assistant_tool_calls").update({ status: "executed", result, executed_at: new Date().toISOString() }).eq("id", toolCallId);
    await supabase.from("audit_log").insert({ workspace_id: workspaceId, actor_type: "ai", actor_id: memberId, action: `assistant_tool.${row.tool_key}`, entity_type: "assistant_tool_call", entity_id: toolCallId, metadata: { arguments: args, result } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo completar la acción.";
    await supabase.from("assistant_tool_calls").update({ status: "failed", error: message }).eq("id", toolCallId);
    const reply = `No pude completarlo: ${message}`;
    await supabase.from("assistant_messages").insert({ conversation_id: row.conversation_id, role: "assistant", content: reply });
    await supabase.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", row.conversation_id as string);
    revalidateAssistant();
    return { reply };
  }

  // La acción ya se ejecutó — desde acá, cualquier problema (sin OpenRouter,
  // fallo del modelo) solo afecta la REDACCIÓN, nunca se reporta como que
  // la acción falló.
  let reply: string;
  const credentialsForNarration = await requireApiKey(workspaceId);
  if (credentialsForNarration.ok) {
    try {
      reply = await narrateToolResult(credentialsForNarration.apiKey, row.tool_key as string, args, result);
    } catch {
      reply = "Listo, ya está hecho.";
    }
  } else {
    reply = "Listo, ya está hecho.";
  }

  await supabase.from("assistant_messages").insert({ conversation_id: row.conversation_id, role: "assistant", content: reply });
  await supabase.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", row.conversation_id as string);
  revalidateAssistant();
  return { reply };
}

export async function rejectToolCallAction(toolCallId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: row } = await supabase.from("assistant_tool_calls").select("conversation_id, status").eq("id", toolCallId).eq("workspace_id", workspaceId).eq("member_id", memberId ?? "").maybeSingle();
  if (!row || row.status !== "proposed") return;

  await supabase.from("assistant_tool_calls").update({ status: "rejected" }).eq("id", toolCallId);
  await supabase.from("assistant_messages").insert({ conversation_id: row.conversation_id, role: "assistant", content: "Dale, no hago nada — avisame si querés otra cosa." });
  revalidateAssistant();
}

export interface AssistantDashboard {
  today: Awaited<ReturnType<typeof getTodaySummaryCard>>;
  priorities: Awaited<ReturnType<typeof getPriorityItems>>;
  alerts: Awaited<ReturnType<typeof getAlerts>>;
  crossSell: Awaited<ReturnType<typeof getCrossSellCandidates>>;
  weeklyPerformance: Awaited<ReturnType<typeof getWeeklyPerformance>>;
  upcomingMeetings: Awaited<ReturnType<typeof getUpcomingMeetings>>;
}

export async function getAssistantDashboardAction(): Promise<AssistantDashboard> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) throw new Error("No se pudo resolver tu usuario en este workspace.");

  const [today, priorities, alerts, crossSell, weeklyPerformance, upcomingMeetings] = await Promise.all([
    getTodaySummaryCard(workspaceId, memberId),
    getPriorityItems(workspaceId),
    getAlerts(workspaceId),
    getCrossSellCandidates(workspaceId),
    getWeeklyPerformance(workspaceId),
    getUpcomingMeetings(workspaceId, memberId),
  ]);

  return { today, priorities, alerts, crossSell, weeklyPerformance, upcomingMeetings };
}

/** "Recomendaciones automáticas" — bajo demanda (botón), nunca automático:
 * narra en texto las prioridades ya calculadas de forma determinística, sin
 * agregar ningún número nuevo. */
export async function generateRecommendationsAction(): Promise<string | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const credentials = await requireApiKey(workspaceId);
  if (!credentials.ok) return { error: credentials.error };
  const apiKey = credentials.apiKey;
  const priorities = await getPriorityItems(workspaceId);

  if (priorities.length === 0) return "No hay nada urgente ahora mismo — buen momento para prospectar clientes nuevos.";

  const completion = await complete({
    apiKey,
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"],
    temperature: 0.5,
    tools: [],
    messages: [
      {
        role: "system",
        content: "Sos el Asistente IA de un CRM de seguros. Te paso una lista de prioridades ya calculadas (reales, no las inventes ni cambies los datos) y armás 2-3 recomendaciones accionables cortas, en español, tono directo.",
      },
      { role: "user", content: `Prioridades de hoy:\n${priorities.map((p) => `- ${p.label} (${p.detail})`).join("\n")}` },
    ],
  });

  return completion.message?.content?.trim() || "No pude armar recomendaciones ahora — probá de nuevo.";
}
