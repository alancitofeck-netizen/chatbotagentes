"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getValidGoogleSheetsAccessToken, fetchSpreadsheetMetadata, parseSpreadsheetId } from "@/lib/integrations/googleSheets";
import { runKpiSyncForSetter } from "@/lib/kpis/syncRunner";
import { getKpiEntries, getKpiGoals, getKpiSetterOptions, getKpiSetterSheets } from "@/lib/kpis/queries";

export async function getKpiEntriesAction(filters: { periodMonth: string; weekNumber?: number; setterId?: string; teamId?: string }) {
  const { workspaceId } = await requireActiveWorkspace();
  return getKpiEntries(workspaceId, filters);
}

export async function getKpiSetterOptionsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getKpiSetterOptions(workspaceId);
}

export async function getKpiGoalsAction(periodMonth: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getKpiGoals(workspaceId, periodMonth);
}

export async function getKpiSetterSheetsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getKpiSetterSheets(workspaceId);
}

/** Creates a new setter row with no sheet linked yet — the admin names the
 * setter first, then links their sheet via setKpiSetterSheetAction (or later,
 * via "Cambiar hoja"). Separate step because a setter can exist (e.g. to
 * pre-configure the roster) before they've actually shared their sheet. */
export async function createKpiSetterAction(displayName: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!displayName.trim()) throw new Error("El nombre del setter es obligatorio.");

  const supabase = await createClient();
  const { error } = await supabase.from("kpi_setters").insert({
    workspace_id: workspaceId,
    display_name: displayName.trim(),
    normalized_name: displayName.trim().toLowerCase(),
  });
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un setter con ese nombre.");
    throw new Error("No se pudo crear el setter.");
  }

  revalidatePath("/profile");
  revalidatePath("/crm");
}

export async function removeKpiSetterAction(setterId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const supabase = await createClient();
  const { error } = await supabase.from("kpi_setters").delete().eq("id", setterId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo eliminar el setter (puede tener datos históricos asociados).");

  revalidatePath("/profile");
  revalidatePath("/crm");
}

/** Links (or changes, "Cambiar hoja") a setter's own Google Sheet — one file
 * per setter (confirmed with the user), read via the workspace's single
 * connected Google account (the setter shares their file with that account
 * for view access; no per-setter OAuth login). Validates the sheet is
 * actually reachable before saving. */
export async function setKpiSetterSheetAction(setterId: string, input: { spreadsheetInput: string; sheetName?: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const spreadsheetId = parseSpreadsheetId(input.spreadsheetInput);
  if (!spreadsheetId) throw new Error("No se pudo reconocer el link o ID de la hoja de Google Sheets.");

  const accessToken = await getValidGoogleSheetsAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá primero la cuenta de Google en Configuración → Integraciones.");

  const metadata = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const sheetName = input.sheetName || metadata.sheets[0]?.title || "Hoja 1";

  const supabase = await createClient();
  const { error } = await supabase
    .from("kpi_setters")
    .update({ spreadsheet_id: spreadsheetId, sheet_name: sheetName, status: "active", last_sync_status: "pending", last_sync_error: null })
    .eq("id", setterId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo guardar la hoja de este setter.");

  revalidatePath("/profile");
  revalidatePath("/crm");
  return { spreadsheetTitle: metadata.title, availableSheets: metadata.sheets.map((s) => s.title) };
}

export async function unlinkKpiSetterSheetAction(setterId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const supabase = await createClient();
  const { error } = await supabase
    .from("kpi_setters")
    .update({ spreadsheet_id: null, sheet_name: null, status: "inactive" })
    .eq("id", setterId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo desconectar la hoja.");

  revalidatePath("/profile");
  revalidatePath("/crm");
}

/** "Sincronizar ahora" — runs the exact same per-setter sync the cron job
 * runs (src/lib/kpis/syncRunner.ts) for every setter with a sheet linked in
 * this workspace, so the manual and automatic paths never drift apart. */
export async function syncKpisNowAction() {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const supabase = await createClient();
  const { data: setters } = await supabase
    .from("kpi_setters")
    .select("id, spreadsheet_id, sheet_name")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .not("spreadsheet_id", "is", null);

  if (!setters || setters.length === 0) throw new Error("No hay ningún setter con una hoja de Google Sheets conectada.");

  const results = await Promise.all(
    setters.map((s) =>
      runKpiSyncForSetter(workspaceId, { id: s.id as string, spreadsheetId: s.spreadsheet_id as string, sheetName: s.sheet_name as string | null }),
    ),
  );

  revalidatePath("/crm");
  revalidatePath("/profile");
  const rowsWritten = results.reduce((sum, r) => sum + r.weeksWritten, 0);
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, rowsWritten, failedCount: failed.length, error: failed[0]?.error };
}

export async function setKpiGoalAction(periodMonth: string, metricKey: string, targetValue: number) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!Number.isFinite(targetValue) || targetValue < 0) throw new Error("La meta debe ser un número válido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("kpi_goals")
    .upsert({ workspace_id: workspaceId, period_month: periodMonth, metric_key: metricKey, target_value: Math.round(targetValue) }, { onConflict: "workspace_id,period_month,metric_key" });
  if (error) throw new Error("No se pudo guardar la meta.");

  revalidatePath("/crm");
}

export async function linkKpiSetterAction(setterId: string, memberId: string | null) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  const supabase = await createClient();
  const { error } = await supabase
    .from("kpi_setters")
    .update({ linked_member_id: memberId })
    .eq("id", setterId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo vincular el setter.");

  revalidatePath("/crm");
}
