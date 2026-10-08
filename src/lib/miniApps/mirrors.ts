import "server-only";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Copia espejo de una Mini App en otro workspace (mini_apps.mirror_of, ver
 * 0194_mini_app_mirrors.sql). Comparte el slug con la original, pero toda
 * resolución pública por slug se queda con la original (`mirror_of is null`);
 * los espejos solo reciben copias de lo que entra por ella. */
export interface MiniAppMirror {
  id: string;
  workspace_id: string;
  name: string;
  assigned_agent_id: string | null;
}

/** Espejos de una Mini App original. Ante un error devuelve [] — copiar a los
 * espejos nunca debe hacer fallar la escritura de la original. */
export async function getMiniAppMirrors(supabase: ServiceClient, sourceMiniAppId: string): Promise<MiniAppMirror[]> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select("id, workspace_id, name, assigned_agent_id")
    .eq("mirror_of", sourceMiniAppId);
  if (error) {
    console.error("[mini-apps] failed to load mirrors:", error);
    return [];
  }
  return (data ?? []) as MiniAppMirror[];
}

/** La fila original + sus espejos, como destinos `{ workspace_id, mini_app_id }`
 * para replicar un insert (visitas, eventos del embudo). */
export async function withMirrorTargets(
  supabase: ServiceClient,
  app: { id: string; workspace_id: string },
): Promise<{ workspace_id: string; mini_app_id: string }[]> {
  const mirrors = await getMiniAppMirrors(supabase, app.id);
  return [app, ...mirrors].map((a) => ({ workspace_id: a.workspace_id, mini_app_id: a.id }));
}
