import "server-only";
import { createClient } from "@/lib/supabase/server";

const PROVIDER = "manychat";

/** Enlace de la hoja de ManyChat del workspace. Vive en `integration_connections.metadata`
 * (no en el navegador), así lo ve todo el equipo desde cualquier dispositivo. */
export async function getManychatSheetLink(workspaceId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  const metadata = (data?.metadata ?? {}) as { sheetUrl?: unknown };
  return typeof metadata.sheetUrl === "string" ? metadata.sheetUrl : null;
}

/** Guarda el enlace. Devuelve `false` si ManyChat todavía no está conectado (no hay fila de integración). */
export async function saveManychatSheetLink(workspaceId: string, sheetUrl: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("id, metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (!data) return false;
  const metadata = { ...((data.metadata ?? {}) as Record<string, unknown>), sheetUrl };
  const { error } = await supabase.from("integration_connections").update({ metadata }).eq("id", data.id as string);
  return !error;
}
