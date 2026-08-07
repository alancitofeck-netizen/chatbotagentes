import "server-only";
import { createClient } from "@/lib/supabase/server";
import { IMPORT_ENTITY_LABEL, type ImportEntityType } from "@/lib/dataTransfer/constants";

export interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  userName: string | null;
  fileName: string;
  records: number;
  status: "ok" | "error" | "partial";
}

/** "Historial" pedido por el usuario — UNIONa data_import_jobs +
 * data_export_jobs por fecha en vez de una tercera tabla que habría que
 * mantener en sync con las otras dos (ver la nota en la migración 0111). */
export async function getDataTransferHistory(workspaceId: string, limit = 50): Promise<HistoryEntry[]> {
  const supabase = await createClient();
  const [{ data: imports }, { data: exports_ }] = await Promise.all([
    supabase
      .from("data_import_jobs")
      .select("id, entity_type, file_name, total_rows, success_count, error_count, created_by, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("data_export_jobs")
      .select("id, entity_type, format, file_name, record_count, created_by, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const actorIds = [
    ...new Set([...(imports ?? []).map((r) => r.created_by), ...(exports_ ?? []).map((r) => r.created_by)].filter((id): id is string => Boolean(id))),
  ];
  const { data: names } = actorIds.length ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId }) : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>(((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]));

  const entries: HistoryEntry[] = [
    ...(imports ?? []).map((r) => {
      const entityLabel = IMPORT_ENTITY_LABEL[r.entity_type as ImportEntityType] ?? (r.entity_type as string);
      return {
        id: r.id as string,
        date: r.created_at as string,
        action: `Importó ${entityLabel}`,
        userName: r.created_by ? (nameByMember.get(r.created_by as string) ?? null) : null,
        fileName: r.file_name as string,
        records: r.success_count as number,
        status: (r.error_count as number) === 0 ? "ok" : (r.success_count as number) === 0 ? "error" : "partial",
      } satisfies HistoryEntry;
    }),
    ...(exports_ ?? []).map((r) => {
      const entityLabel = IMPORT_ENTITY_LABEL[r.entity_type as ImportEntityType] ?? (r.entity_type as string);
      return {
        id: r.id as string,
        date: r.created_at as string,
        action: `Exportó ${entityLabel} (${(r.format as string).toUpperCase()})`,
        userName: r.created_by ? (nameByMember.get(r.created_by as string) ?? null) : null,
        fileName: r.file_name as string,
        records: r.record_count as number,
        status: "ok" as const,
      } satisfies HistoryEntry;
    }),
  ];

  return entries.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

/** Fire-and-forget: registra un export en el historial — llamado desde
 * /api/documents/export (ruta genérica ya existente y reusada por
 * Contactos/Prospectos/Tareas/Calendario/Agentes/Reportes/Cobros) y desde
 * /api/policies/export. Nunca debe romper la descarga si falla. */
export async function logExportJob(workspaceId: string, memberId: string | null, entityType: string, format: string, fileName: string, recordCount: number): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("data_export_jobs").insert({ workspace_id: workspaceId, entity_type: entityType, format, file_name: fileName, record_count: recordCount, created_by: memberId });
  } catch (err) {
    console.error("[dataTransfer] logExportJob failed:", err);
  }
}

export interface MappingPreset {
  id: string;
  name: string;
  mapping: Record<string, string | null>;
}

export async function getMappingPresets(workspaceId: string, entityType: ImportEntityType): Promise<MappingPreset[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_column_mapping_presets")
    .select("id, name, mapping")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, mapping: r.mapping as Record<string, string | null> }));
}
