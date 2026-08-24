import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { normalizeE164 } from "@/lib/integrations/ycloud";

/** Busca un contacto por teléfono (dedupe ya establecido en toda la app) o
 * lo crea — mismo patrón que leadSync/runner.ts's processRow. Vive acá (no
 * en un módulo específico como policies/) porque más de un módulo lo
 * necesita sin acoplarse entre sí (Pólizas, Asesoría Guiada) — extraído
 * originalmente de policies/actions.ts (que tiene "use server" a nivel de
 * archivo, donde una función con un parámetro no serializable como
 * `supabase` no puede vivir).
 *
 * `dni`/`cuit` son opcionales — cuando vienen (ej. Agente IA de Cartera, que
 * los saca del portal de la aseguradora) se intentan ANTES que teléfono/
 * email, exacto, sin fuzzy: es el identificador más confiable que puede dar
 * un portal de pólizas. `contacts.dni`/`cuit` no tienen unique constraint
 * (0055_contacts_import_fields.sql), así que este match es un `select`
 * normal, no un upsert por constraint. */
export async function findOrCreateContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  input: { name?: string; phone?: string; email?: string; dni?: string; cuit?: string },
  source: string,
): Promise<string> {
  if (input.dni) {
    const { data: existing } = await supabase.from("contacts").select("id").eq("workspace_id", workspaceId).eq("dni", input.dni).maybeSingle();
    if (existing) return existing.id as string;
  }
  if (input.cuit) {
    const { data: existing } = await supabase.from("contacts").select("id").eq("workspace_id", workspaceId).eq("cuit", input.cuit).maybeSingle();
    if (existing) return existing.id as string;
  }

  if (input.phone) {
    const phone = normalizeE164(input.phone);
    const { data: existing } = await supabase.from("contacts").select("id").eq("workspace_id", workspaceId).eq("phone", phone).maybeSingle();
    if (existing) return existing.id as string;
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({ workspace_id: workspaceId, name: input.name?.trim() || phone, phone, email: input.email || null, dni: input.dni || null, cuit: input.cuit || null, source })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "No se pudo crear el contacto.");
    return created.id as string;
  }

  if (input.email) {
    const { data: existing } = await supabase.from("contacts").select("id").eq("workspace_id", workspaceId).eq("email", input.email).maybeSingle();
    if (existing) return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("contacts")
    .insert({ workspace_id: workspaceId, name: input.name?.trim() || "Cliente sin nombre", email: input.email || null, dni: input.dni || null, cuit: input.cuit || null, source })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "No se pudo crear el contacto.");
  return created.id as string;
}
