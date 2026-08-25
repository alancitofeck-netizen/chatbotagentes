import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isQuotaExceeded } from "@/lib/ai/quotas";
import { isOutsideBusinessHours } from "@/lib/ai/businessHours";

/**
 * Decision Engine (docs/blueprint/13-agent-engine.md #3) — explicit gate run
 * right after the Buffer Inteligente claims a batch, deciding whether the
 * Agent Runtime (OpenRouter) gets invoked at all. Pure/side-effect-free by
 * design (easier to unit test, mirrors this repo's queries.ts/actions.ts
 * split) — the caller (bufferDispatch.ts) applies whatever side effects an
 * outcome implies.
 */
export type DecisionOutcome =
  | { type: "ai_respond"; promptId: string; agentId: string; moduleKey: string; responseMode: "auto" | "assisted" }
  | { type: "human_respond" }
  | { type: "wait" }
  | { type: "escalate"; reason: string }
  | { type: "run_automation"; automationId: string }
  | { type: "invoke_tool_directly"; toolKey: string; arguments: Record<string, unknown> };

export interface DecisionInput {
  /** Must be a service-role client — this runs from a cron/webhook context
   * with no signed-in user, so RLS would block every read otherwise. */
  supabase: SupabaseClient;
  workspaceId: string;
  conversationId: string;
  /** Concatenated text of the buffered messages, for keyword-automation matching. */
  messageText: string;
}

export async function decide(input: DecisionInput): Promise<DecisionOutcome> {
  const { supabase, workspaceId, conversationId, messageText } = input;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, mode, status, contact_id, contacts(whatsapp_opt_status)")
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!conversation) return { type: "wait" };
  // 'paused' (Agentes IA de Referidos, Fase 4) se trata igual que 'human':
  // el agente nunca se invoca. Es semánticamente distinto ("nadie está
  // atendiendo activamente, seguimientos cancelados" vs. "el asesor está
  // atendiendo ahora") pero el motor no necesita diferenciarlos — mismo
  // outcome, mismo "sin acción" en bufferDispatch.ts.
  if (conversation.mode === "human" || conversation.mode === "paused") return { type: "human_respond" };
  if (conversation.status === "closed") return { type: "wait" };

  const contact = Array.isArray(conversation.contacts) ? conversation.contacts[0] : conversation.contacts;
  if (contact?.whatsapp_opt_status === "unsubscribed") {
    return { type: "escalate", reason: "contact_unsubscribed" };
  }

  // Module resolution (ambigüedad #3 del plan, resuelta con el usuario): si
  // el contacto ya es candidato (postuló a una vacante), usar el prompt de
  // ATS; si no, el de CRM. Reutiliza `candidates` (extensión 1:1 de
  // contacts), no inventa una columna nueva en `conversations`.
  //
  // "Referidos" (Fase 4, Agentes IA de Referidos) tiene prioridad sobre
  // ambas: si este contacto es un referido autorizado (asesoria_referrals,
  // la MISMA whitelist que ya usan los webhooks — nunca se toca esa lógica
  // acá, solo se lee), el motor debe usar el agente de referidos, aunque
  // ese mismo contacto también tenga una oportunidad de CRM abierta — un
  // referido en gestión activa es más específico que "cualquier lead CRM".
  const { data: referral } = await supabase
    .from("asesoria_referrals")
    .select("id, advisor_id")
    .eq("workspace_id", workspaceId)
    .eq("referred_contact_id", conversation.contact_id)
    .maybeSingle();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", conversation.contact_id)
    .maybeSingle();
  const moduleKey = referral ? "referrals" : candidate ? "ats" : "crm";

  const { data: moduleRow } = await supabase
    .from("workspace_modules")
    .select("enabled")
    .eq("workspace_id", workspaceId)
    .eq("module_key", moduleKey)
    .maybeSingle();
  if (!moduleRow?.enabled) {
    return { type: "escalate", reason: "module_not_enabled" };
  }

  // Cuota preflight (docs/blueprint/05-ai-engine.md "Límites y costo") — se
  // suma el costo real del período vigente (excluye usage_events.is_sandbox,
  // que se factura pero no cuenta contra la cuota de tráfico real).
  if (await isQuotaExceeded(supabase, workspaceId)) {
    return { type: "escalate", reason: "quota_exceeded" };
  }

  // Resolución de agente (Fase "Agentes IA"): un workspace puede tener
  // varios agentes nombrados por módulo — nunca se adivina cuál responde.
  const { data: activeAgentsRaw } = await supabase
    .from("ai_agents")
    .select("id, business_hours, response_mode, advisor_id")
    .eq("workspace_id", workspaceId)
    .eq("module_key", moduleKey)
    .eq("status", "active")
    .contains("channels", ["whatsapp"]); // único canal real hoy
  let activeAgents = activeAgentsRaw ?? [];

  // Referidos: si hay más de un agente activo, no es necesariamente
  // ambiguo — puede haber un agente por asesor (ai_agents.advisor_id) más
  // uno "para todo el workspace" (advisor_id null). Se prefiere el agente
  // cuyo advisor_id coincide con el del referido; si ninguno coincide, cae
  // al agente sin advisor_id (workspace-wide); si sigue habiendo más de
  // uno tras ese filtro, ahí sí es genuinamente ambiguo. crm/ats no pasan
  // por esta rama — moduleKey solo es 'referrals' cuando `referral` existe.
  if (moduleKey === "referrals" && activeAgents.length > 1 && referral) {
    const matchingAdvisor = activeAgents.filter((a) => a.advisor_id === referral.advisor_id);
    activeAgents = matchingAdvisor.length > 0 ? matchingAdvisor : activeAgents.filter((a) => a.advisor_id === null);
  }

  if (activeAgents.length === 0) {
    return { type: "escalate", reason: "no_active_agent" };
  }
  if (activeAgents.length > 1) {
    return { type: "escalate", reason: "multiple_active_agents_ambiguous" };
  }
  const agent = activeAgents[0];

  // Horario de funcionamiento — reutiliza el mecanismo de handoff existente
  // en vez de un estado "degradado" paralelo (mismo criterio que el
  // blueprint ya pide para fallo de proveedor/cuota).
  if (isOutsideBusinessHours(agent.business_hours)) {
    return { type: "escalate", reason: "outside_business_hours" };
  }

  const { data: prompt } = await supabase
    .from("ai_prompts")
    .select("id")
    .eq("agent_id", agent.id)
    .eq("status", "active")
    .maybeSingle();
  if (!prompt) {
    return { type: "escalate", reason: "no_active_prompt" };
  }

  // Automatización por keyword (automations.trigger = {type:'keyword', keyword})
  // — el único shape que existe hoy (src/lib/automations/actions.ts), no se
  // inventa semántica nueva de triggers.
  const { data: automations } = await supabase
    .from("automations")
    .select("id, trigger")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  const lowerMessage = messageText.toLowerCase();
  const matchedAutomation = (automations ?? []).find((a) => {
    const trigger = a.trigger as { type?: string; keyword?: string } | null;
    return trigger?.type === "keyword" && !!trigger.keyword && lowerMessage.includes(trigger.keyword.toLowerCase());
  });
  if (matchedAutomation) {
    return { type: "run_automation", automationId: matchedAutomation.id as string };
  }

  // Dos palancas independientes activan modo asistido, combinadas con OR:
  // conversations.mode='hybrid' (un operador supervisando esta conversación
  // puntual) y ai_agents.response_mode='assisted' (política del agente en
  // general) — no se reemplaza una por la otra.
  const responseMode: "auto" | "assisted" =
    conversation.mode === "hybrid" || agent.response_mode === "assisted" ? "assisted" : "auto";

  return { type: "ai_respond", promptId: prompt.id as string, agentId: agent.id as string, moduleKey, responseMode };
}
