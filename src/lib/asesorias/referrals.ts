import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAsesoriaList } from "@/lib/asesorias/queries";
import { propagateReferralStatus } from "@/lib/asesorias/referralSystem";
import { triggerReferralExport } from "@/lib/asesorias/referralExport/runner";

export type ReferralStatus = "nuevo" | "contactado" | "interesado" | "no_interesado" | "cita_agendada" | "convertido";

export const REFERRAL_STATUSES: ReferralStatus[] = ["nuevo", "contactado", "interesado", "no_interesado", "cita_agendada", "convertido"];

export interface ReferralRow {
  id: string;
  /** null para referidos de Mini Apps (?ref=, ver referralFromLead.ts) —
   * esos no vienen de ninguna Asesoría real, así que no hay a qué
   * "Ver asesoría" enlazar. */
  asesoriaId: string | null;
  /** Nombre del prospecto que lo refirió — resuelto por join contra
   * `asesorias` (contactName si tiene contacto vinculado, si no el nombre
   * tipeado), nunca guardado como columna propia. "Mini App" para
   * referidos sin asesoria_id. */
  asesoriaName: string;
  advisorName: string | null;
  /** Fase 4 (Agentes IA de Referidos) — el `workspace_members.id` real, no
   * solo el nombre ya resuelto: hace falta para resolver qué agente de
   * referidos (ai_agents.advisor_id) atiende a este referido. */
  advisorId: string | null;
  referredContactId: string | null;
  name: string;
  phone: string;
  status: ReferralStatus;
  createdAt: string;
  updatedAt: string;
  /** true si otro referido en el workspace resolvió al mismo contacto
   * (mismo teléfono normalizado) — nunca se borra/mezcla, solo se marca. */
  isDuplicate: boolean;
}

/** Referidos capturados dentro de las Asesorías (asesoria_referrals, ver
 * 0120_asesoria_referrals.sql), con el nombre del prospecto/asesor
 * resueltos reutilizando getAsesoriaList (mismo dato que ya arma el
 * listado principal) en vez de duplicar el join/RPC acá. */
export async function getWorkspaceReferrals(workspaceId: string, advisorId?: string): Promise<ReferralRow[]> {
  const supabase = await createClient();
  let referralsQuery = supabase
    .from("asesoria_referrals")
    .select("id, asesoria_id, advisor_id, referred_contact_id, name, phone, status, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (advisorId) referralsQuery = referralsQuery.eq("advisor_id", advisorId);

  const [{ data: referrals }, asesorias] = await Promise.all([referralsQuery, getAsesoriaList(workspaceId, "all")]);

  const asesoriaById = new Map(asesorias.map((a) => [a.id, a]));

  const contactCounts = new Map<string, number>();
  for (const r of referrals ?? []) {
    if (!r.referred_contact_id) continue;
    const key = r.referred_contact_id as string;
    contactCounts.set(key, (contactCounts.get(key) ?? 0) + 1);
  }

  return (referrals ?? []).map((r) => {
    const asesoriaId = r.asesoria_id as string | null;
    const asesoria = asesoriaId ? asesoriaById.get(asesoriaId) : undefined;
    const referredContactId = r.referred_contact_id as string | null;
    return {
      id: r.id as string,
      asesoriaId,
      asesoriaName: asesoriaId ? (asesoria?.contactName ?? asesoria?.name ?? "Prospecto") : "Mini App",
      advisorName: asesoria?.advisorName ?? null,
      advisorId: (r.advisor_id as string | null) ?? null,
      referredContactId,
      name: r.name as string,
      phone: r.phone as string,
      status: r.status as ReferralStatus,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      isDuplicate: referredContactId ? (contactCounts.get(referredContactId) ?? 0) > 1 : false,
    };
  });
}

/** Borra TODOS los referidos del workspace — irreversible, gateado a
 * owner/admin (misma policy RLS "asesoria_referrals_delete" ya existente
 * desde 0120_asesoria_referrals.sql, ver también requireManagerRole en el
 * caller). No borra los Contactos que esos referidos hayan generado —
 * mismo criterio que deleteMiniAppLead (miniApps/actions.ts): son datos
 * del CRM por derecho propio en ese punto. Cascada automática sobre
 * referral_sheet_exports (FK on delete cascade, 0197), así que no deja
 * basura en el registro de exportación. */
export async function deleteAllReferrals(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("asesoria_referrals").delete().eq("workspace_id", workspaceId).select("id");
  if (error) throw new Error("No se pudieron eliminar los referidos.");
  return data?.length ?? 0;
}

export async function updateReferralStatus(referralId: string, workspaceId: string, status: ReferralStatus): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("asesoria_referrals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", referralId)
    .eq("workspace_id", workspaceId);
  // Sistema de Referidos: el mismo referido en la otra cuenta del grupo queda con el mismo estado.
  await propagateReferralStatus(referralId);
  // Exportar a hoja (si hay una conectada): best-effort, nunca bloquea esta acción.
  triggerReferralExport(workspaceId, referralId);
}
