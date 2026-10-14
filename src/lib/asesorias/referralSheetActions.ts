"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace } from "@/lib/auth/session";
import {
  getValidGoogleSheetsExportAccessToken,
  getGoogleSheetsExportAccountStatus,
  disconnectGoogleSheetsExport,
  fetchSpreadsheetMetadata,
  fetchColumnValues,
  parseSpreadsheetId,
  type GoogleSheetsExportAccountStatus,
} from "@/lib/integrations/googleSheetsExport";
import { exportReferralToSheet } from "@/lib/asesorias/referralExport/runner";

export interface ReferralSheetConnection {
  spreadsheetId: string;
  sheetName: string;
  startRow: number;
  columnMap: { numero: string; lead: string; nombre: string; telefono: string; agendo: string };
  status: "active" | "paused";
  lastSyncStatus: "pending" | "ok" | "error";
  lastSyncError: string | null;
  lastSyncedAt: string | null;
}

export async function getReferralSheetConnectionAction(): Promise<{ account: GoogleSheetsExportAccountStatus; connection: ReferralSheetConnection | null; pendingCount: number }> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const [account, { data: row }] = await Promise.all([
    getGoogleSheetsExportAccountStatus(workspaceId),
    supabase.from("referral_sheet_connections").select("*").eq("workspace_id", workspaceId).maybeSingle(),
  ]);

  let pendingCount = 0;
  if (row) {
    const { count: pending } = await supabase
      .from("referral_sheet_exports")
      .select("id", { count: "exact", head: true })
      .eq("connection_id", row.id as string)
      .eq("last_export_status", "pending");
    pendingCount = pending ?? 0;
  }

  return {
    account,
    connection: row
      ? {
          spreadsheetId: row.spreadsheet_id as string,
          sheetName: row.sheet_name as string,
          startRow: row.start_row as number,
          columnMap: row.column_map as ReferralSheetConnection["columnMap"],
          status: row.status as ReferralSheetConnection["status"],
          lastSyncStatus: row.last_sync_status as ReferralSheetConnection["lastSyncStatus"],
          lastSyncError: row.last_sync_error as string | null,
          lastSyncedAt: row.last_synced_at as string | null,
        }
      : null,
    pendingCount,
  };
}

export async function saveReferralSheetConnectionAction(input: {
  spreadsheetInput: string;
  sheetName: string;
  startRow: number;
  columnMap: ReferralSheetConnection["columnMap"];
}): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();

  const spreadsheetId = parseSpreadsheetId(input.spreadsheetInput);
  if (!spreadsheetId) throw new Error("No se pudo reconocer el link o ID de la hoja de Google Sheets.");
  if (!input.sheetName.trim()) throw new Error("Falta el nombre de la pestaña.");
  if (!Number.isInteger(input.startRow) || input.startRow < 1) throw new Error("La fila de inicio tiene que ser un número entero positivo.");

  const supabase = await createClient();
  const { error } = await supabase.from("referral_sheet_connections").upsert(
    {
      workspace_id: workspaceId,
      spreadsheet_id: spreadsheetId,
      sheet_name: input.sheetName.trim(),
      start_row: input.startRow,
      column_map: input.columnMap,
      status: "active",
      last_sync_status: "pending",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
  if (error) throw new Error("No se pudo guardar la configuración. Verificá que tengas permisos de owner/admin.");

  revalidatePath("/asesorias/referidos");
}

export async function testReferralSheetConnectionAction(input: { spreadsheetInput: string; sheetName: string }): Promise<{ ok: true; title: string; availableSheets: string[] } | { ok: false; error: string }> {
  const { workspaceId } = await requireActiveWorkspace();

  const spreadsheetId = parseSpreadsheetId(input.spreadsheetInput);
  if (!spreadsheetId) return { ok: false, error: "No se pudo reconocer el link o ID de la hoja de Google Sheets." };

  const accessToken = await getValidGoogleSheetsExportAccessToken(workspaceId);
  if (!accessToken) return { ok: false, error: "Conectá primero tu cuenta de Google con el botón de arriba." };

  try {
    const metadata = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
    const sheetName = input.sheetName.trim() || metadata.sheets[0]?.title;
    if (!sheetName || !metadata.sheets.some((s) => s.title === sheetName)) {
      return { ok: false, error: `No existe ninguna pestaña llamada "${sheetName}" en esa hoja.` };
    }
    // Confirma que además de leer metadata, se puede leer el rango de valores real (mismo permiso que usa el export).
    await fetchColumnValues(accessToken, spreadsheetId, sheetName, "A", 1);
    return { ok: true, title: metadata.title, availableSheets: metadata.sheets.map((s) => s.title) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo conectar con la hoja." };
  }
}

export async function disconnectReferralSheetAction(): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await disconnectGoogleSheetsExport(workspaceId);
  const supabase = await createClient();
  await supabase.from("referral_sheet_connections").update({ status: "paused" }).eq("workspace_id", workspaceId);
  revalidatePath("/asesorias/referidos");
}

/** Botón manual "Exportar a hoja" — procesa todos los referidos que todavía
 * no se exportaron (o quedaron en error/pending), de punta a punta
 * (Mini Apps incluidas, a diferencia de la exportación automática que solo
 * dispara para referidos que vienen de una asesoría real). Secuencial a
 * propósito, no Promise.all: dos referidos del mismo lead exportándose a la
 * vez podrían calcular la misma "próxima fila libre" y pisarse. */
export async function exportPendingReferralsAction(): Promise<{ exported: number; stillPending: number }> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: connection } = await supabase.from("referral_sheet_connections").select("id").eq("workspace_id", workspaceId).eq("status", "active").maybeSingle();
  if (!connection) throw new Error("Configurá primero a qué hoja exportar.");

  const service = createServiceRoleClient();
  const { data: allReferrals } = await service.from("asesoria_referrals").select("id").eq("workspace_id", workspaceId);
  const referralIds = (allReferrals ?? []).map((r) => r.id as string);
  if (referralIds.length === 0) return { exported: 0, stillPending: 0 };

  const { data: alreadyOk } = await service.from("referral_sheet_exports").select("referral_id").eq("connection_id", connection.id as string).eq("last_export_status", "ok").in("referral_id", referralIds);
  const okIds = new Set((alreadyOk ?? []).map((r) => r.referral_id as string));
  const toExport = referralIds.filter((id) => !okIds.has(id));

  let exported = 0;
  for (const referralId of toExport) {
    await exportReferralToSheet(workspaceId, referralId);
    exported++;
  }

  const { count: stillPending } = await service.from("referral_sheet_exports").select("id", { count: "exact", head: true }).eq("connection_id", connection.id as string).eq("last_export_status", "pending");

  revalidatePath("/asesorias/referidos");
  return { exported, stillPending: stillPending ?? 0 };
}
