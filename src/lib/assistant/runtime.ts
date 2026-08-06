import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { complete, type OpenRouterMessage } from "@/lib/integrations/openrouter";
import { ASSISTANT_TOOL_BY_KEY, assistantToolDefsForModel } from "@/lib/assistant/tools/registry";
import type { AssistantToolContext } from "@/lib/assistant/tools/shared";

/**
 * Loop propio del Asistente IA — mismo patrón conceptual que
 * src/lib/ai/agentRuntime.ts (complete() + tool-calling acotado en
 * iteraciones), pero sin sus piezas específicas de WhatsApp (Decision
 * Engine, Buffer Inteligente, envío real, escalamiento) — ver la nota de
 * arquitectura en la migración 0106. Las herramientas que cambian datos
 * nunca se ejecutan durante este loop: quedan "proposed" y el modelo recibe
 * un resultado de "awaiting_user_confirmation", así puede seguir
 * conversando con naturalidad sin que la acción ya haya pasado.
 */

const MAX_ITERATIONS = 5;
const MEMORY_LIMIT = 20;
const MODEL_CHAIN = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

const SYSTEM_PROMPT = [
  "Sos el Asistente IA de Growth Link, el copiloto de un asesor dentro de su propio CRM (no hablás con un cliente externo, hablás con el propio usuario).",
  "Tono cercano y profesional en español, mensajes cortos tipo chat de WhatsApp, sin formalismos innecesarios.",
  "Usá las herramientas disponibles para consultar datos reales del CRM antes de responder — nunca inventes números, fechas, nombres de clientes o montos.",
  "Para acciones que cambian datos (crear tarea, mover una oportunidad de etapa, registrar un pago, crear una reunión, crear una cotización, o redactar una respuesta a un cliente), llamá a la herramienta igual — el sistema le va a pedir confirmación al usuario antes de ejecutarla de verdad, vos no tenés que preguntar 'confirmás?' en el texto ni esperar una respuesta de 'sí': simplemente proponé la acción llamando a la herramienta y el sistema se encarga del resto.",
  "Nunca digas que ya hiciste algo si la herramienta todavía no se ejecutó de verdad.",
].join(" ");

export interface AssistantTurnResult {
  reply: string;
  pendingToolCallIds: string[];
}

async function loadHistory(supabase: SupabaseClient, conversationId: string): Promise<OpenRouterMessage[]> {
  const { data } = await supabase
    .from("assistant_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(MEMORY_LIMIT);
  return ((data ?? []) as { role: string; content: string | null }[]).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

export async function runAssistantTurn(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  memberId: string;
  conversationId: string;
  apiKey: string;
  userText: string;
}): Promise<AssistantTurnResult> {
  const { supabase, workspaceId, memberId, conversationId, apiKey, userText } = params;

  const history = await loadHistory(supabase, conversationId);
  await supabase.from("assistant_messages").insert({ conversation_id: conversationId, role: "user", content: userText });

  const messages: OpenRouterMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: userText }];

  const toolCtx: AssistantToolContext = { supabase, workspaceId, memberId };
  const pendingToolCallIds: string[] = [];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const completion = await complete({ apiKey, messages, tools: assistantToolDefsForModel(), models: MODEL_CHAIN, temperature: 0.4 });

    if (!completion.toolCalls.length) {
      const replyText = completion.message?.content?.trim() || "No pude generar una respuesta — probá reformular el pedido.";
      await supabase.from("assistant_messages").insert({ conversation_id: conversationId, role: "assistant", content: replyText, pending_tool_call_ids: pendingToolCallIds });
      await supabase.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
      return { reply: replyText, pendingToolCallIds };
    }

    messages.push({ role: "assistant", content: completion.message?.content ?? null, tool_calls: completion.toolCalls });

    for (const call of completion.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }

      const toolDef = ASSISTANT_TOOL_BY_KEY.get(call.function.name);
      if (!toolDef) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "unknown_tool" }) });
        continue;
      }

      if (toolDef.requiresConfirmation) {
        const { data: toolCallRow } = await supabase
          .from("assistant_tool_calls")
          .insert({ workspace_id: workspaceId, member_id: memberId, conversation_id: conversationId, tool_key: toolDef.key, arguments: args, status: "proposed", requires_confirmation: true })
          .select("id")
          .single();
        if (toolCallRow) pendingToolCallIds.push(toolCallRow.id as string);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ status: "awaiting_user_confirmation" }) });
        continue;
      }

      try {
        const result = await toolDef.handler(args, toolCtx);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      } catch (err) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: err instanceof Error ? err.message : "handler_failed" }) });
      }
    }
  }

  const fallback = "Se me complicó resolver esto en varios pasos — probá pedírmelo de una forma más simple.";
  await supabase.from("assistant_messages").insert({ conversation_id: conversationId, role: "assistant", content: fallback, pending_tool_call_ids: pendingToolCallIds });
  return { reply: fallback, pendingToolCallIds };
}

/** Redacta la confirmación en lenguaje natural DESPUÉS de que el handler ya
 * corrió de verdad (fuera de este archivo, ver actions.ts) — un llamado
 * simple sin herramientas, nunca inventa el resultado, solo lo redacta. */
export async function narrateToolResult(apiKey: string, toolKey: string, args: Record<string, unknown>, result: unknown): Promise<string> {
  const toolDef = ASSISTANT_TOOL_BY_KEY.get(toolKey);
  const completion = await complete({
    apiKey,
    models: MODEL_CHAIN,
    temperature: 0.5,
    tools: [],
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `El usuario acaba de confirmar la acción "${toolDef?.description ?? toolKey}" con estos datos: ${JSON.stringify(args)}. El resultado real fue: ${JSON.stringify(result)}. Redactá 1-2 oraciones cortas confirmándole al usuario que ya se hizo, con los datos concretos del resultado (sin inventar nada más). Podés usar un emoji si suena natural.`,
      },
    ],
  });
  return completion.message?.content?.trim() || "Listo, ya está hecho.";
}
