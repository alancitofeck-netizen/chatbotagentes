import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import type { LeadSyncFieldKey } from "./fieldDictionary";

export interface LeadSheetConnectionRow {
  id: string;
  spreadsheetId: string;
  sheetGid: string | null;
  sheetName: string;
  columnMap: Record<string, LeadSyncFieldKey>;
  pipelineId: string;
  defaultStageId: string;
  defaultOwnerId: string | null;
  status: "active" | "paused";
  lastSyncedAt: string | null;
  lastSyncStatus: "pending" | "ok" | "error";
  lastSyncError: string | null;
  rowCount: number;
}

function mapRow(row: Record<string, unknown>): LeadSheetConnectionRow {
  return {
    id: row.id as string,
    spreadsheetId: row.spreadsheet_id as string,
    sheetGid: (row.sheet_gid as string | null) ?? null,
    sheetName: row.sheet_name as string,
    columnMap: (row.column_map as Record<string, LeadSyncFieldKey>) ?? {},
    pipelineId: row.pipeline_id as string,
    defaultStageId: row.default_stage_id as string,
    defaultOwnerId: (row.default_owner_id as string | null) ?? null,
    status: row.status as "active" | "paused",
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    lastSyncStatus: row.last_sync_status as "pending" | "ok" | "error",
    lastSyncError: (row.last_sync_error as string | null) ?? null,
    rowCount: (row.row_count as number) ?? 0,
  };
}

export async function getLeadSheetConnections(): Promise<LeadSheetConnectionRow[]> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_sheet_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapRow);
}

export interface PipelineStageOption {
  id: string;
  name: string;
}

export async function getPipelineStageOptions(pipelineId: string): Promise<PipelineStageOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pipeline_stages").select("id, name").eq("pipeline_id", pipelineId).order("position", { ascending: true });
  return (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
}
