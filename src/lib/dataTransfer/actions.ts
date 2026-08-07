"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { isSupportedFileName, isXlsxFileName, listWorkbookSheets, parseExcelSheet, parseCsvFile, type SheetInfo } from "@/lib/advisors/import/parseFile";
import { detectColumnMapping } from "@/lib/dataTransfer/columnMapping";
import {
  FIELD_DICTIONARY_BY_ENTITY,
  type ImportEntityType,
} from "@/lib/dataTransfer/constants";
import { detectPolicyColumnMapping } from "@/lib/policies/import";
import { POLICY_FIELD_DICTIONARY } from "@/lib/policies/constants";
import { importPolicyRows } from "@/lib/policies/import";
import { importContactRows, importTaskRows, importEventRows, importPaymentRows, logImportJob, type ImportResult } from "@/lib/dataTransfer/importers";
import { getDataTransferHistory, getMappingPresets, type HistoryEntry } from "@/lib/dataTransfer/queries";
import { createBackup, getBackups, getBackupDownloadUrl, restoreBackup, type BackupSummary, type RestoreSummary } from "@/lib/dataTransfer/backups";
import { getGoogleSheetsAccountStatus } from "@/lib/integrations/googleSheets";
import { getGoogleDriveStatus, getValidGoogleDriveAccessToken, uploadFileToDrive } from "@/lib/integrations/googleDrive";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_IMPORT_ROWS = 1000;

function revalidateDataTransfer() {
  revalidatePath("/importar-exportar");
}

export interface DataImportPreview {
  needsSheetSelection: boolean;
  sheets: SheetInfo[];
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
}

function suggestMapping(entityType: ImportEntityType, headers: string[]): Record<string, string | null> {
  const suggestions =
    entityType === "policies" ? detectPolicyColumnMapping(headers) : detectColumnMapping(headers, FIELD_DICTIONARY_BY_ENTITY[entityType] ?? []);
  return Object.fromEntries(suggestions.map((s) => [s.header, s.fieldKey]));
}

async function buildPreview(entityType: ImportEntityType, headers: string[], rows: Record<string, string>[], totalRows: number): Promise<DataImportPreview> {
  return { needsSheetSelection: false, sheets: [], headers, rows, totalRows, suggestedMapping: suggestMapping(entityType, headers) };
}

export async function parseDataImportFileAction(formData: FormData, entityType: ImportEntityType): Promise<DataImportPreview> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "data_transfer");
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No se recibió ningún archivo.");
  if (!isSupportedFileName(file.name)) throw new Error("Formato no soportado — usá .xlsx o .csv.");

  const buffer = await file.arrayBuffer();
  if (isXlsxFileName(file.name)) {
    const sheets = await listWorkbookSheets(buffer);
    if (sheets.length > 1) return { needsSheetSelection: true, sheets, headers: [], rows: [], totalRows: 0, suggestedMapping: {} };
    const table = await parseExcelSheet(buffer, sheets[0]?.name ?? "", MAX_IMPORT_ROWS);
    return buildPreview(entityType, table.headers, table.rows, table.totalRows);
  }

  const text = await file.text();
  const table = parseCsvFile(text, MAX_IMPORT_ROWS);
  return buildPreview(entityType, table.headers, table.rows, table.totalRows);
}

export async function parseDataImportSheetAction(formData: FormData, sheetName: string, entityType: ImportEntityType): Promise<DataImportPreview> {
  await requireActiveWorkspace();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No se recibió ningún archivo.");
  const buffer = await file.arrayBuffer();
  const table = await parseExcelSheet(buffer, sheetName, MAX_IMPORT_ROWS);
  return buildPreview(entityType, table.headers, table.rows, table.totalRows);
}

export async function getFieldDictionaryAction(entityType: ImportEntityType) {
  return entityType === "policies" ? POLICY_FIELD_DICTIONARY : (FIELD_DICTIONARY_BY_ENTITY[entityType] ?? []);
}

export async function confirmDataImportAction(
  entityType: ImportEntityType,
  fileName: string,
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
): Promise<ImportResult> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "data_transfer");
  const memberId = await getCurrentMemberId(workspaceId);

  let result: ImportResult;
  switch (entityType) {
    case "contacts":
      result = await importContactRows(workspaceId, rows, mapping);
      break;
    case "tasks":
      result = await importTaskRows(workspaceId, memberId, rows, mapping);
      break;
    case "events":
      result = await importEventRows(workspaceId, memberId, rows, mapping);
      break;
    case "payments":
      result = await importPaymentRows(workspaceId, rows, mapping);
      break;
    case "policies": {
      const policyResult = await importPolicyRows(workspaceId, memberId, rows, mapping, memberId);
      result = { created: policyResult.created, errors: policyResult.errors };
      break;
    }
    default:
      throw new Error("Este tipo de dato se importa desde su propio asistente.");
  }

  await logImportJob(workspaceId, memberId, entityType, fileName, rows.length, result);
  revalidateDataTransfer();
  return result;
}

export async function saveMappingPresetAction(entityType: ImportEntityType, name: string, mapping: Record<string, string | null>): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("data_column_mapping_presets")
    .upsert({ workspace_id: workspaceId, entity_type: entityType, name: name.trim(), mapping }, { onConflict: "workspace_id,entity_type,name" });
  if (error) throw new Error("No se pudo guardar el mapeo.");
}

export async function getMappingPresetsAction(entityType: ImportEntityType) {
  const { workspaceId } = await requireActiveWorkspace();
  return getMappingPresets(workspaceId, entityType);
}

export async function getDataTransferHistoryAction(): Promise<HistoryEntry[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getDataTransferHistory(workspaceId);
}

// ---------------------------------------------------------------------------
// Backups — "Restaurar" reusa el motor de import (backups.ts), nunca un
// camino de inserción destructivo aparte.
// ---------------------------------------------------------------------------

export async function createBackupAction(): Promise<BackupSummary> {
  const { workspaceId, role } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin") throw new Error("Solo Owner/Admin pueden crear backups.");
  const memberId = await getCurrentMemberId(workspaceId);
  const backup = await createBackup(workspaceId, memberId);
  revalidateDataTransfer();
  return backup;
}

export async function getBackupsAction(): Promise<BackupSummary[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getBackups(workspaceId);
}

export async function getBackupDownloadUrlAction(backupId: string): Promise<string> {
  const { workspaceId } = await requireActiveWorkspace();
  return getBackupDownloadUrl(workspaceId, backupId);
}

export async function restoreBackupAction(backupId: string): Promise<RestoreSummary> {
  const { workspaceId, role } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin") throw new Error("Solo Owner/Admin pueden restaurar backups.");
  const memberId = await getCurrentMemberId(workspaceId);
  const summary = await restoreBackup(workspaceId, memberId, backupId);
  revalidateDataTransfer();
  return summary;
}

export async function uploadBackupToDriveAction(backupId: string): Promise<{ webViewLink: string | null }> {
  const { workspaceId } = await requireActiveWorkspace();
  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá Google Drive primero (Perfil → Integraciones).");

  const supabase = await createClient();
  const { data: backup } = await supabase.from("data_backups").select("storage_path").eq("id", backupId).eq("workspace_id", workspaceId).maybeSingle();
  if (!backup) throw new Error("Backup no encontrado.");

  const service = createServiceRoleClient();
  const { data: file, error } = await service.storage.from("backups").download(backup.storage_path as string);
  if (error || !file) throw new Error("No se pudo leer el backup.");

  const fileName = (backup.storage_path as string).split("/").pop() ?? "backup.json";
  const result = await uploadFileToDrive(accessToken, { name: fileName, mimeType: "application/json", buffer: await file.arrayBuffer(), parentFolderId: null });
  return { webViewLink: result.webViewLink };
}

// ---------------------------------------------------------------------------
// Sincronización — solo Google Sheets y Google Drive tienen OAuth real hoy
// (integration_connections, ver googleSheets.ts/googleDrive.ts). Outlook,
// Google Contacts y Dropbox/OneDrive no tienen backend todavía — el resto
// del módulo los muestra como "Próximamente" en vez de un botón "Conectar"
// que no llevaría a ningún lado.
// ---------------------------------------------------------------------------

export interface SyncStatus {
  googleSheets: { connected: boolean; email: string | null };
  googleDrive: { connected: boolean; email: string | null };
}

export async function getSyncStatusAction(): Promise<SyncStatus> {
  const { workspaceId } = await requireActiveWorkspace();
  const [googleSheets, googleDrive] = await Promise.all([getGoogleSheetsAccountStatus(workspaceId), getGoogleDriveStatus(workspaceId)]);
  return { googleSheets, googleDrive };
}
