import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStageId, type LeadOverride } from "@/lib/manychat/leads";

/** Ediciones de los leads de ManyChat hechas desde el CRM (manychat_lead_overrides, 0195). */
export async function getManychatLeadOverrides(workspaceId: string): Promise<LeadOverride[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manychat_lead_overrides")
    .select("lead_ref, nombre, telefono, email, usuario, nota, etapa, valor")
    .eq("workspace_id", workspaceId);
  return (data ?? []).map((row) => ({
    ref: row.lead_ref as string,
    nombre: (row.nombre as string | null) ?? null,
    telefono: (row.telefono as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    usuario: (row.usuario as string | null) ?? null,
    nota: (row.nota as string | null) ?? null,
    etapa: isStageId(row.etapa) ? row.etapa : null,
    valor: row.valor === null || row.valor === undefined ? null : Number(row.valor),
  }));
}
