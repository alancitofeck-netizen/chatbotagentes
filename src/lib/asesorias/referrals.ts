import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAsesoriaList } from "@/lib/asesorias/queries";

export type ReferralStatus = "nuevo" | "contactado" | "interesado" | "no_interesado" | "convertido";

export interface ReferralRow {
  id: string;
  asesoriaId: string;
  /** Nombre del prospecto que lo refirió — resuelto por join contra
   * `asesorias` (contactName si tiene contacto vinculado, si no el nombre
   * tipeado), nunca guardado como columna propia. */
  asesoriaName: string;
  advisorName: string | null;
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
export async function getWorkspaceReferrals(workspaceId: string): Promise<ReferralRow[]> {
  const supabase = await createClient();
  const [{ data: referrals }, asesorias] = await Promise.all([
    supabase
      .from("asesoria_referrals")
      .select("id, asesoria_id, advisor_id, referred_contact_id, name, phone, status, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getAsesoriaList(workspaceId),
  ]);

  const asesoriaById = new Map(asesorias.map((a) => [a.id, a]));

  const contactCounts = new Map<string, number>();
  for (const r of referrals ?? []) {
    if (!r.referred_contact_id) continue;
    const key = r.referred_contact_id as string;
    contactCounts.set(key, (contactCounts.get(key) ?? 0) + 1);
  }

  return (referrals ?? []).map((r) => {
    const asesoria = asesoriaById.get(r.asesoria_id as string);
    const referredContactId = r.referred_contact_id as string | null;
    return {
      id: r.id as string,
      asesoriaId: r.asesoria_id as string,
      asesoriaName: asesoria?.contactName ?? asesoria?.name ?? "Prospecto",
      advisorName: asesoria?.advisorName ?? null,
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

export async function updateReferralStatus(referralId: string, workspaceId: string, status: ReferralStatus): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("asesoria_referrals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", referralId)
    .eq("workspace_id", workspaceId);
}
