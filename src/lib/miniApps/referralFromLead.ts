import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoStartReferralConversationIfEligible } from "@/lib/asesorias/autoStartConversation";

/** Mismo criterio ya usado en diagnosticoRetiroTemplate.ts (normalizePhone,
 * client-side, solo para armar un link wa.me): un número de 10 dígitos es
 * un celular mexicano sin código de país — se le antepone "52", igual que
 * ya hace esa plantilla. 11-15 dígitos se asume que ya trae código de
 * país. Fuera de ese rango, nunca se adivina — se descarta en vez de
 * arriesgar un número mal armado. */
function normalizeMiniAppPhoneForReferral(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** "Solo si viene con ?ref=" — decisión confirmada explícitamente por el
 * usuario. Un lead de Mini App con `data.referidoPor` cargado (algunas
 * plantillas ya leen `?ref=` de la URL, ver ingest.ts) se convierte en un
 * referido autorizado (asesoria_referrals, asesoria_id=null) del asesor
 * dueño de esa Mini App — reusa exactamente la misma whitelist/motor que
 * ya usan los referidos de Asesorías, nunca un mecanismo paralelo.
 *
 * Best-effort — nunca lanza, nunca bloquea el guardado del lead en sí
 * (mismo criterio que linkLeadToContact/syncInsuranceProspect, llamadas
 * inmediatamente antes en processLeadSubmission). */
export async function createReferralFromMiniAppLeadIfEligible(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    assignedAgentId: string | null;
    referidoPor: unknown;
    nombre: string;
    whatsapp: string;
    contactId: string | undefined;
  },
): Promise<void> {
  try {
    const referidoPor = typeof input.referidoPor === "string" ? input.referidoPor.trim() : "";
    if (!referidoPor) return; // no vino con ?ref= -> sigue siendo un lead normal, nunca un referido
    if (!input.assignedAgentId) return; // Mini App sin asesor asignado -> no hay a quién atribuírselo
    if (!input.contactId) return; // el contacto no se pudo resolver -> nada que autorizar

    const phone = normalizeMiniAppPhoneForReferral(input.whatsapp);
    if (!phone) return;

    // Dedupe manual: un mismo visitante puede completar más de un Mini
    // App con el mismo ?ref= — asesoria_id=null en TODOS esos casos, así
    // que el unique(asesoria_id, phone) de la tabla no alcanza (Postgres
    // trata cada NULL como distinto entre sí).
    const { data: existing } = await supabase
      .from("asesoria_referrals")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .is("asesoria_id", null)
      .eq("phone", phone)
      .maybeSingle();

    let referralId: string;
    if (existing) {
      referralId = existing.id as string;
    } else {
      const { data: created, error } = await supabase
        .from("asesoria_referrals")
        .insert({
          workspace_id: input.workspaceId,
          asesoria_id: null,
          advisor_id: input.assignedAgentId,
          referred_contact_id: input.contactId,
          name: input.nombre,
          phone,
          status: "nuevo",
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "insert_failed");
      referralId = created.id as string;
    }

    await autoStartReferralConversationIfEligible(supabase, input.workspaceId, referralId);
  } catch (err) {
    console.error("[mini-apps] failed to create referral from ?ref= lead:", err);
  }
}
