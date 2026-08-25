import type { ToolContext } from "@/lib/ai/tools/shared";

/** Tope de intentos — pedido explícito ("máximo de intentos") — Fase 4,
 * punto 7. El disparo automático real (el cron que efectivamente manda el
 * seguimiento) queda para la siguiente pasada; esta tool solo deja la
 * estructura lista (referral_followups) para que el agente pueda programar
 * un intento futuro. */
const MAX_FOLLOWUP_ATTEMPTS = 3;

/** `schedule_followup` — side-effecting, Agentes IA de Referidos (Fase 4).
 * Igual que update_referral: el referido se resuelve server-side desde
 * ctx.contactId, nunca confiando en un id que venga del modelo. El número
 * de intento se calcula contando seguimientos NO cancelados ya programados
 * para este referido — el modelo solo decide cuántos días esperar. */
export async function scheduleFollowup(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const daysFromNow = typeof args.days_from_now === "number" && args.days_from_now > 0 ? args.days_from_now : 1;

  const { data: referral } = await ctx.supabase
    .from("asesoria_referrals")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("referred_contact_id", ctx.contactId)
    .maybeSingle();
  if (!referral) throw new Error("referral_not_found_for_conversation");

  const { count } = await ctx.supabase
    .from("referral_followups")
    .select("id", { count: "exact", head: true })
    .eq("referral_id", referral.id)
    .neq("status", "cancelled");
  const attemptNumber = (count ?? 0) + 1;
  if (attemptNumber > MAX_FOLLOWUP_ATTEMPTS) {
    return { scheduled: false, reason: "max_attempts_reached" };
  }

  const scheduledAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const { data: followup, error } = await ctx.supabase
    .from("referral_followups")
    .insert({
      workspace_id: ctx.workspaceId,
      referral_id: referral.id,
      conversation_id: ctx.conversationId,
      agent_id: ctx.agentId ?? null,
      attempt_number: attemptNumber,
      scheduled_at: scheduledAt.toISOString(),
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !followup) throw new Error("schedule_followup_failed");

  return { followupId: followup.id, attemptNumber, scheduledAt: scheduledAt.toISOString() };
}
