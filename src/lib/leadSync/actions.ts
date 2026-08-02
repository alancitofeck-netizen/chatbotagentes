"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getValidGoogleSheetsAccessToken, fetchSpreadsheetMetadata, fetchSheetValues, parseSpreadsheetId } from "@/lib/integrations/googleSheets";
import { detectLeadSyncColumnMapping } from "./fieldDictionary";
import { runLeadSheetSync } from "./runner";
import {
  getLeadSheetConnections,
  getPipelineStageOptions,
  getLeadSheetSyncRuns,
  getLeadSheetSyncRunErrors,
  type LeadSheetConnectionRow,
} from "./queries";
import type { LeadSyncFieldKey } from "./fieldDictionary";

async function requireSheetsToken(workspaceId: string): Promise<string> {
  const token = await getValidGoogleSheetsAccessToken(workspaceId);
  if (!token) throw new Error("Conectá Google Sheets primero (Perfil → Integraciones).");
  return token;
}

export async function getLeadSheetConnectionsAction() {
  return getLeadSheetConnections();
}

export async function getPipelineStageOptionsAction(pipelineId: string) {
  return getPipelineStageOptions(pipelineId);
}

/** Step 1 of the wizard — resolves a pasted URL/id into its tabs, so the
 * user picks "Agendas" (or whatever the tab is called) from a real list
 * instead of typing a gid by hand. */
export async function inspectSpreadsheetAction(spreadsheetUrlOrId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const spreadsheetId = parseSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId) throw new Error("No pudimos reconocer ese link o ID de Google Sheets.");
  const token = await requireSheetsToken(workspaceId);
  const metadata = await fetchSpreadsheetMetadata(token, spreadsheetId);
  return { spreadsheetId, ...metadata };
}

/** Step 2 — reads just the header row + a couple of sample rows for the
 * mapping step's auto-suggestion and preview, without pulling the whole
 * sheet twice (the real sync run re-reads it fresh). */
export async function inspectSheetColumnsAction(spreadsheetId: string, sheetName: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const token = await requireSheetsToken(workspaceId);
  const rows = await fetchSheetValues(token, spreadsheetId, sheetName);
  const headers = rows[0] ?? [];
  const sampleRows = rows.slice(1, 4);
  const suggestions = detectLeadSyncColumnMapping(headers);
  return { headers, sampleRows, suggestions };
}

export interface SaveLeadSheetConnectionInput {
  connectionId?: string;
  spreadsheetId: string;
  sheetGid: string | null;
  sheetName: string;
  columnMap: Record<string, LeadSyncFieldKey>;
  pipelineId: string;
  defaultStageId: string;
  defaultOwnerId: string | null;
}

export async function saveLeadSheetConnectionAction(input: SaveLeadSheetConnectionInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  // column_map is keyed by sheet header, valued by our field key — check by
  // value, not by key, since we don't know the header spellings up front.
  if (!Object.values(input.columnMap).includes("contactName") || !Object.values(input.columnMap).includes("phone")) {
    throw new Error("Mapeá al menos Nombre del contacto y Teléfono antes de guardar.");
  }

  const supabase = await createClient();
  const payload = {
    workspace_id: workspaceId,
    spreadsheet_id: input.spreadsheetId,
    sheet_gid: input.sheetGid,
    sheet_name: input.sheetName,
    column_map: input.columnMap,
    pipeline_id: input.pipelineId,
    default_stage_id: input.defaultStageId,
    default_owner_id: input.defaultOwnerId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = input.connectionId
    ? await supabase.from("lead_sheet_connections").update(payload).eq("id", input.connectionId).select("id").single()
    : await supabase.from("lead_sheet_connections").insert(payload).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo guardar la conexión.");

  revalidatePath("/profile");
  return { id: data.id as string };
}

export async function pauseLeadSheetConnectionAction(connectionId: string, status: "active" | "paused") {
  const { role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  await supabase.from("lead_sheet_connections").update({ status }).eq("id", connectionId);
  revalidatePath("/profile");
}

export async function deleteLeadSheetConnectionAction(connectionId: string) {
  const { role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  await supabase.from("lead_sheet_connections").delete().eq("id", connectionId);
  revalidatePath("/profile");
}

/** "Sincronizar ahora" — same runLeadSheetSync the cron uses (see
 * src/app/api/cron/sync-lead-sheets/route.ts), just invoked directly for one
 * connection instead of claimed from a batch. Re-fetches the connection row
 * itself rather than trusting whatever the client already had in memory. */
export async function triggerManualLeadSheetSyncAction(connectionId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { data } = await supabase.from("lead_sheet_connections").select("*").eq("id", connectionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!data) throw new Error("Conexión no encontrada.");

  const connection = {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    spreadsheet_id: data.spreadsheet_id as string,
    sheet_name: data.sheet_name as string,
    column_map: (data.column_map as Record<string, LeadSyncFieldKey>) ?? {},
    pipeline_id: data.pipeline_id as string,
    default_stage_id: data.default_stage_id as string,
    default_owner_id: (data.default_owner_id as string | null) ?? null,
    last_sheet_hash: (data.last_sheet_hash as string | null) ?? null,
  };

  const result = await runLeadSheetSync(connection, "manual");
  revalidatePath("/profile");
  return result;
}

/** Historial pedido por el usuario — lista de corridas (cron o manual) con
 * conteos de creados/actualizados/omitidos/fallidos por corrida. */
export async function getLeadSheetSyncRunsAction(connectionId: string) {
  await requireActiveWorkspace();
  return getLeadSheetSyncRuns(connectionId);
}

/** Motivo de cada fila fallida dentro de una corrida puntual. */
export async function getLeadSheetSyncRunErrorsAction(runId: string) {
  await requireActiveWorkspace();
  return getLeadSheetSyncRunErrors(runId);
}

export type { LeadSheetConnectionRow };
