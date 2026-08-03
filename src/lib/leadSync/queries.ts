import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import type { LeadSyncFieldKey } from "./fieldDictionary";
import type { LeadSheetConnectionRow } from "./types";

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
    lastSheetHash: (row.last_sheet_hash as string | null) ?? null,
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

export interface LeadSheetSyncRunRow {
  id: string;
  trigger: "cron" | "manual";
  status: "running" | "ok" | "error";
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  rowsRead: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
}

function mapRun(row: Record<string, unknown>): LeadSheetSyncRunRow {
  return {
    id: row.id as string,
    trigger: row.trigger as "cron" | "manual",
    status: row.status as "running" | "ok" | "error",
    errorMessage: (row.error_message as string | null) ?? null,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    rowsRead: (row.rows_read as number) ?? 0,
    createdCount: (row.created_count as number) ?? 0,
    updatedCount: (row.updated_count as number) ?? 0,
    skippedCount: (row.skipped_count as number) ?? 0,
    errorCount: (row.error_count as number) ?? 0,
  };
}

/** RLS on lead_sheet_sync_runs joins through lead_sheet_connections'
 * workspace, so scoping by connectionId alone is already safe — no
 * workspaceId check needed here (mirrors how lead_sheet_rows is read). */
export async function getLeadSheetSyncRuns(connectionId: string, limit = 20): Promise<LeadSheetSyncRunRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_sheet_sync_runs")
    .select("*")
    .eq("connection_id", connectionId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapRun);
}

export interface LeadSheetSyncRowErrorRow {
  id: string;
  rowNumber: number;
  rowKey: string | null;
  message: string;
  createdAt: string;
}

export async function getLeadSheetSyncRunErrors(runId: string): Promise<LeadSheetSyncRowErrorRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_sheet_sync_row_errors")
    .select("*")
    .eq("run_id", runId)
    .order("row_number", { ascending: true });
  return (data ?? []).map((row) => ({
    id: row.id as string,
    rowNumber: row.row_number as number,
    rowKey: (row.row_key as string | null) ?? null,
    message: row.message as string,
    createdAt: row.created_at as string,
  }));
}
