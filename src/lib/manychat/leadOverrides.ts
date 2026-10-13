import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStageId, phoneKey, type LeadOverride } from "@/lib/manychat/leads";

/** Ediciones de los leads de ManyChat hechas desde el CRM (manychat_lead_overrides, 0195). */
export async function getManychatLeadOverrides(workspaceId: string): Promise<LeadOverride[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manychat_lead_overrides")
    .select("id, lead_ref, nombre, telefono, email, usuario, nota, etapa, valor")
    .eq("workspace_id", workspaceId);
  return (data ?? []).map((row) => ({
    id: row.id as string,
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

/** Tipo con el que Documentos asocia un PDF a un lead de ManyChat. `related_id` es el id de su fila en
 * manychat_lead_overrides (los leads de la hoja no tienen uuid propio). */
export const MANYCHAT_LEAD_DOCUMENT_TYPE = "manychat_lead";

/** PDFs subidos a cada lead, por lead_ref. Los que están en la papelera de Documentos no se muestran. */
export async function getManychatLeadDocuments(workspaceId: string, overrides: LeadOverride[]): Promise<Map<string, { id: string; name: string }[]>> {
  const byRef = new Map<string, { id: string; name: string }[]>();
  if (overrides.length === 0) return byRef;
  const refById = new Map(overrides.map((o) => [o.id, o.ref]));
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, name, related_id")
    .eq("workspace_id", workspaceId)
    .eq("related_type", MANYCHAT_LEAD_DOCUMENT_TYPE)
    .eq("is_trashed", false)
    .order("created_at", { ascending: true });
  for (const doc of data ?? []) {
    const ref = refById.get(doc.related_id as string);
    if (!ref) continue;
    byRef.set(ref, [...(byRef.get(ref) ?? []), { id: doc.id as string, name: doc.name as string }]);
  }
  return byRef;
}

/** Proyecciones hechas en las mini apps del workspace, agrupadas por teléfono (phoneKey), para mostrarlas en
 * el lead de ManyChat con el mismo número. La más reciente primero. */
export async function getMiniAppProjectionsByPhone(workspaceId: string): Promise<Map<string, { leadId: string; origen: string; fecha: string }[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mini_app_leads")
    .select("id, whatsapp, origen_app, fecha")
    .eq("workspace_id", workspaceId)
    .order("fecha", { ascending: false })
    .limit(5000);
  const byPhone = new Map<string, { leadId: string; origen: string; fecha: string }[]>();
  for (const row of data ?? []) {
    const key = phoneKey(row.whatsapp as string);
    if (!key) continue;
    byPhone.set(key, [...(byPhone.get(key) ?? []), { leadId: row.id as string, origen: (row.origen_app as string) || "Mini app", fecha: row.fecha as string }]);
  }
  return byPhone;
}
