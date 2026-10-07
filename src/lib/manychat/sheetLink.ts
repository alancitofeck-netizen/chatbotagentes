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

/** Guarda el enlace. Si el workspace todavía no tiene la fila de integración de ManyChat (el webhook se
 * conecta aparte, desde Perfil → Integraciones), la crea inactiva y sin secreto: así `getManychatStatus` sigue
 * diciendo "no conectado", y cuando después se genere el secreto del webhook se reutiliza esta misma fila. La
 * hoja se lee del servidor y no depende del webhook. Devuelve `false` solo si no se pudo guardar. */
export async function saveManychatSheetLink(workspaceId: string, sheetUrl: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("id, metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (!data) {
    // external_account_id es NOT NULL; igual que generateManychatWebhookSecret, se usa el id del workspace.
    const { error } = await supabase
      .from("integration_connections")
      .insert({ workspace_id: workspaceId, provider: PROVIDER, external_account_id: workspaceId, status: "inactive", metadata: { sheetUrl } });
    return !error;
  }
  const metadata = { ...((data.metadata ?? {}) as Record<string, unknown>), sheetUrl };
  const { error } = await supabase.from("integration_connections").update({ metadata }).eq("id", data.id as string);
  return !error;
}
