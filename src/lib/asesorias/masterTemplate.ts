import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Plantilla base guardada por ESE asesor puntual (tabla `asesoria_templates`,
 * clave (workspace_id, advisor_id) — ver
 * supabase/migrations/0118_asesoria_master_template.sql) — se persiste
 * desde /api/asesorias/[asesoriaId]/save-master-template cada vez que ese
 * asesor edita el deck de una asesoría y aprieta "Guardar". No es
 * compartida entre asesores del mismo workspace, a propósito. Solo
 * `template` se usa hoy para sembrar asesorías nuevas (ver seed.ts) —
 * `theme`/`brand` quedan disponibles acá para un eventual uso futuro,
 * deliberadamente sin usarlos todavía (ver el plan de esta sesión). */
export async function getAsesoriaMasterTemplate(workspaceId: string, advisorId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asesoria_templates")
    .select("template")
    .eq("workspace_id", workspaceId)
    .eq("advisor_id", advisorId)
    .maybeSingle();
  if (!data || !data.template) return null;
  return data.template as Record<string, unknown>;
}
