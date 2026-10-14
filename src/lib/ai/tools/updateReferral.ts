import type { ToolContext } from "@/lib/ai/tools/shared";
import { updateReferralStatus, REFERRAL_STATUSES, type ReferralStatus } from "@/lib/asesorias/referrals";

/** `update_referral` — side-effecting, Agentes IA de Referidos (Fase 4).
 * A diferencia de create_appointment/create_opportunity, no confía en NINGÚN
 * id que venga del modelo: el referido se resuelve server-side a partir de
 * ctx.contactId + ctx.workspaceId (la misma fila que ya arma
 * agentRuntime.ts::buildContext para el moduleContext de 'referrals'), así
 * que el modelo solo puede mandar el `status` nuevo, nunca elegir a mano
 * sobre qué referido escribir. Delega el update en sí a
 * updateReferralStatus() (asesorias/referrals.ts) — la misma función que usa
 * el cambio manual de estado desde la UI — en vez de duplicar el
 * update+propagate acá: antes este archivo tenía su propia copia, lo que
 * dejó pasar un estado nuevo (cita_agendada) sin actualizarse acá hasta
 * romper en otro lado. Un solo lugar valida el enum y dispara la
 * propagación de Sistema de Referidos y la exportación a hoja. */
export async function updateReferral(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const status = String(args.status ?? "");
  if (!REFERRAL_STATUSES.includes(status as ReferralStatus)) {
    throw new Error(`status must be one of: ${REFERRAL_STATUSES.join(", ")}`);
  }

  const { data: referral } = await ctx.supabase
    .from("asesoria_referrals")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("referred_contact_id", ctx.contactId)
    .maybeSingle();
  if (!referral) throw new Error("referral_not_found_for_conversation");

  await updateReferralStatus(referral.id as string, ctx.workspaceId, status as ReferralStatus);

  return { referralId: referral.id, status };
}
