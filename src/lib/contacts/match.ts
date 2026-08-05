import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { normalizeE164 } from "@/lib/integrations/ycloud";

/** Busca un contacto por teléfono (dedupe ya establecido en toda la app) o
 * lo crea — mismo patrón que leadSync/runner.ts's processRow. Vive acá (no
 * en un módulo específico como policies/) porque más de un módulo lo
 * necesita sin acoplarse entre sí (Pólizas, Asesoría Guiada) — extraído
 * originalmente de policies/actions.ts (que tiene "use server" a nivel de
 * archivo, donde una función con un parámetro no serializable como
 * `supabase` no puede vivir). */
export async function findOrCreateContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  input: { name?: string; phone?: string; email?: string },
  source: string,
): Promise<string> {
  if (input.phone) {
    const phone = normalizeE164(input.phone);
    const { data: existing } = await supabase.from("contacts").select("id").eq("workspace_id", workspaceId).eq("phone", phone).maybeSingle();
    if (existing) return existing.id as string;
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({ workspace_id: workspaceId, name: input.name?.trim() || phone, phone, email: input.email || null, source })
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
    .insert({ workspace_id: workspaceId, name: input.name?.trim() || "Cliente sin nombre", email: input.email || null, source })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "No se pudo crear el contacto.");
  return created.id as string;
}
