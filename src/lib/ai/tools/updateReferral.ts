import type { ToolContext } from "@/lib/ai/tools/shared";

const ALLOWED_STATUSES = ["nuevo", "contactado", "interesado", "no_interesado", "convertido"];

/** `update_referral` — side-effecting, Agentes IA de Referidos (Fase 4).
 * A diferencia de create_appointment/create_opportunity, no confía en NINGÚN
 * id que venga del modelo: el referido se resuelve server-side a partir de
 * ctx.contactId + ctx.workspaceId (la misma fila que ya arma
 * agentRuntime.ts::buildContext para el moduleContext de 'referrals'), así
 * que el modelo solo puede mandar el `status` nuevo, nunca elegir a mano
 * sobre qué referido escribir. */
export async function updateReferral(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const status = String(args.status ?? "");
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${ALLOWED_STATUSES.join(", ")}`);
  }

  const { data: referral } = await ctx.supabase
    .from("asesoria_referrals")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("referred_contact_id", ctx.contactId)
    .maybeSingle();
  if (!referral) throw new Error("referral_not_found_for_conversation");

  const { error } = await ctx.supabase.from("asesoria_referrals").update({ status, updated_at: new Date().toISOString() }).eq("id", referral.id);
  if (error) throw new Error("update_referral_failed");

  return { referralId: referral.id, status };
}
