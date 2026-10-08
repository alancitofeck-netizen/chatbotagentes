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

/** La original y todos sus espejos, partiendo de cualquiera de ellos. La página
 * publicada (bundle en Storage, API key embebida) es UNA sola — la de la
 * original, en `{published.workspace_id}/{published.id}/` —, así que subirla,
 * regenerar la key o re-inyectar Calendly desde cualquier copia actúa sobre
 * `published` y deja la config de todas las copias igual.
 *
 * Usa el cliente service-role: los espejos viven en otros workspaces. El que
 * llama ya tiene que haber verificado el acceso a la copia de SU workspace. */
export interface MiniAppGroup {
  published: { id: string; workspace_id: string; slug: string; config: Record<string, unknown>; allowed_origins: string[] };
  copies: { id: string; config: Record<string, unknown> }[];
}

export async function getMiniAppGroup(supabase: ServiceClient, miniAppId: string): Promise<MiniAppGroup | null> {
  const { data: row } = await supabase.from("mini_apps").select("id, mirror_of").eq("id", miniAppId).maybeSingle();
  if (!row) return null;
  const publishedId = (row.mirror_of as string | null) ?? (row.id as string);

  const { data: rows } = await supabase
    .from("mini_apps")
    .select("id, workspace_id, slug, config, allowed_origins, mirror_of")
    .or(`id.eq.${publishedId},mirror_of.eq.${publishedId}`);
  const published = (rows ?? []).find((r) => r.id === publishedId);
  if (!published) return null;

  return {
    published: {
      id: published.id as string,
      workspace_id: published.workspace_id as string,
      slug: published.slug as string,
      config: (published.config as Record<string, unknown>) ?? {},
      allowed_origins: (published.allowed_origins as string[] | null) ?? [],
    },
    copies: (rows ?? []).map((r) => ({ id: r.id as string, config: (r.config as Record<string, unknown>) ?? {} })),
  };
}

/** Aplica `configPatch` (merge sobre la config de cada copia, así nada propio
 * de una copia se pisa) y `columns` a la original y a todos sus espejos. */
export async function updateMiniAppGroup(
  supabase: ServiceClient,
  group: MiniAppGroup,
  configPatch: Record<string, unknown>,
  columns: Record<string, unknown> = {},
): Promise<void> {
  await Promise.all(
    group.copies.map((copy) =>
      supabase
        .from("mini_apps")
        .update({ ...columns, config: { ...copy.config, ...configPatch }, updated_at: new Date().toISOString() })
        .eq("id", copy.id),
    ),
  );
}
