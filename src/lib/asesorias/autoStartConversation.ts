import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultOutboundBusinessNumber, getOrCreateOpenConversationForContact } from "@/lib/messaging/conversations";
import { generateReferralOpener } from "@/lib/ai/agentRuntime";
import { sendOutboundWhatsAppMessage } from "@/lib/messaging/send";
import { logActivity } from "@/lib/activity/log";

/**
 * "Iniciar conversación automáticamente ni bien se carga un referido" —
 * pedido explícito del usuario. Mismo criterio exacto que
 * startReferralConversationAction/sendReferralConversationMessageAction
 * (asesorias/actions.ts), pero sin el paso de edición humana — solo corre
 * cuando el agente de referidos tiene `ai_agents.auto_start_conversations
 * = true` (default false: el usuario lo prende explícitamente por agente,
 * mismo criterio "seguro por defecto" que whatsapp_referrals_only/
 * referral_followup_mode).
 *
 * Idempotente vía `asesoria_referrals.conversation_started_at`: el shim del
 * Meeting OS autoguarda cada ~400ms mientras el asesor completa la
 * reunión, así que esta función se llama muchas veces para el MISMO
 * referido — nunca reintenta uno que ya arrancó. Se marca ANTES de
 * generar/enviar (no después): si el proceso se interrumpe a mitad de
 * camino, nunca queda un referido expuesto a un segundo intento
 * duplicado — en el peor caso, ese referido puntual no recibe el mensaje
 * automático y el asesor lo ve en "Referidos" con status='nuevo' para
 * iniciarlo a mano, igual que cualquier referido de un agente sin este
 * modo activado.
 *
 * Nunca lanza — cualquier error queda logueado, nunca bloquea el guardado
 * principal del caller (mismo criterio best-effort que el resto de
 * sync/route.ts).
 */
export async function autoStartReferralConversationIfEligible(supabase: SupabaseClient, workspaceId: string, referralId: string): Promise<void> {
  try {
    const { data: referral } = await supabase
      .from("asesoria_referrals")
      .select("id, phone, referred_contact_id, advisor_id, conversation_started_at")
      .eq("id", referralId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!referral || referral.conversation_started_at || !referral.referred_contact_id || !referral.phone) return;

    const businessNumber = await getDefaultOutboundBusinessNumber(supabase, workspaceId);
    if (!businessNumber) return;

    // Mismo criterio de desambiguación que decisionEngine.ts/
    // startReferralConversationAction: preferir el agente cuyo advisor_id
    // coincide con el del referido, si no el agente "para todo el
    // workspace" (advisor_id null). Si sigue habiendo más de uno, o
    // ninguno, no adivina — no dispara nada.
    const { data: agentsRaw } = await supabase
      .from("ai_agents")
      .select("id, advisor_id")
      .eq("workspace_id", workspaceId)
      .eq("module_key", "referrals")
      .eq("status", "active")
      .eq("auto_start_conversations", true)
      .contains("channels", ["whatsapp"]);
    let agents = agentsRaw ?? [];
    if (agents.length > 1) {
      const matching = agents.filter((a) => a.advisor_id === referral.advisor_id);
      agents = matching.length > 0 ? matching : agents.filter((a) => a.advisor_id === null);
    }
    if (agents.length !== 1) return;
    const agent = agents[0];

    const { data: prompt } = await supabase.from("ai_prompts").select("id").eq("agent_id", agent.id).eq("status", "active").maybeSingle();
    if (!prompt) return;

    const { error: markError } = await supabase
      .from("asesoria_referrals")
      .update({ conversation_started_at: new Date().toISOString() })
      .eq("id", referralId)
      .is("conversation_started_at", null);
    if (markError) return;

    const conversationId = await getOrCreateOpenConversationForContact(
      supabase,
      workspaceId,
      referral.referred_contact_id as string,
      businessNumber,
      (referral.advisor_id as string | null) ?? null,
    );

    const generated = await generateReferralOpener({ workspaceId, conversationId, promptId: prompt.id as string, agentId: agent.id as string });
    if ("error" in generated) {
      console.error(`[autoStartReferralConversation] generateReferralOpener failed for referral ${referralId}:`, generated.error);
      return;
    }

    // senderType:'ai' (no 'agent') — a diferencia del flujo manual, acá
    // ningún humano aprobó el texto antes de enviarlo.
    const result = await sendOutboundWhatsAppMessage({ supabase, workspaceId, conversationId, content: generated.text, senderType: "ai", senderId: null });
    if (!result.ok) {
      console.error(`[autoStartReferralConversation] send failed for referral ${referralId}:`, result.error);
      return;
    }

    await supabase.from("conversations").update({ mode: "ai" }).eq("id", conversationId).eq("workspace_id", workspaceId);
    await logActivity(supabase, workspaceId, null, "conversation", conversationId, "referral_conversation_auto_started", { referralId, agentId: agent.id });
  } catch (err) {
    console.error(`[autoStartReferralConversation] unexpected error for referral ${referralId}:`, err);
  }
}
