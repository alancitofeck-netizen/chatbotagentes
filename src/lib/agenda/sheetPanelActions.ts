"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { fetchSheetValues, parseSpreadsheetId } from "@/lib/integrations/googleSheets";
import { fetchSpreadsheetMetadata, getGoogleSheetsExportAccountStatus } from "@/lib/integrations/googleSheetsExport";
import { detectAdvisorSyncColumnMapping, type AdvisorSyncFieldKey } from "@/lib/advisorSync/fieldDictionary";
import { runAdvisorSheetSync, toAdvisorSheetConnection, getSheetReadToken, type AdvisorSyncResult } from "@/lib/advisorSync/runner";
import { parseAgendaSheetRows } from "@/lib/advisorSync/sheetRows";
import { phoneLookupCandidates, phoneDigits } from "@/lib/advisorSync/rowParsing";
import { columnLetter } from "@/lib/integrations/googleSheetsExport";
import { getAgendaLeads } from "./queries";
import type { ValueMap } from "./sheetValueOptions";
import type { AgendaSheetConfigInput, AgendaSheetStatus, AgendaSheetTabInspection, AgendaSheetPreview, AgendaLead } from "./sheetPanelTypes";

/** Panel "Conectar hoja de agendas" (Agenda). Configura la conexión PROPIA del workspace
 * (advisor_client_id null, 0155) — cualquier cuenta conecta su hoja; la sync es solo manual
 * ("Actualizar"), pedido explícito. Todo se lee con la cuenta de Google de "Exportar referidos"
 * (google_sheets_export, permiso de escritura, necesario para escribir el estado de vuelta). */

async function requireAgendaWorkspace(): Promise<string> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "agenda");
  return workspaceId;
}

async function requireReadToken(workspaceId: string): Promise<string> {
  const token = await getSheetReadToken(workspaceId);
  if (!token) throw new Error("Conectá primero tu cuenta de Google (Paso 1).");
  return token;
}

export async function getAgendaSheetStatusAction(): Promise<AgendaSheetStatus> {
  const workspaceId = await requireAgendaWorkspace();
  const supabase = await createClient();
  const [account, { data }] = await Promise.all([
    getGoogleSheetsExportAccountStatus(workspaceId),
    supabase.from("advisor_sheet_connections").select("*").eq("workspace_id", workspaceId).is("advisor_client_id", null).maybeSingle(),
  ]);
  if (!data) return { account, connection: null };
  const c = toAdvisorSheetConnection(data);
  return {
    account,
    connection: {
      id: c.id,
      spreadsheetId: c.spreadsheet_id,
      spreadsheetTitle: (data.spreadsheet_title as string | null) ?? "",
      sheetName: c.sheet_name,
      sheetGid: (data.sheet_gid as string | null) ?? null,
      headerRow: c.header_row,
      columnMap: c.column_map,
      valueMap: c.value_map,
      options: c.options,
      utcOffsetMinutes: c.utc_offset_minutes,
      lastSyncedAt: (data.last_synced_at as string | null) ?? null,
      lastSyncStartedAt: (data.last_sync_started_at as string | null) ?? null,
      lastSyncStatus: data.last_sync_status as "pending" | "ok" | "error",
      lastSyncError: (data.last_sync_error as string | null) ?? null,
      rowCount: (data.row_count as number) ?? 0,
    },
  };
}

export async function inspectAgendaSpreadsheetAction(urlOrId: string): Promise<{ spreadsheetId: string; title: string; tabs: { title: string; gid: string }[] }> {
  const workspaceId = await requireAgendaWorkspace();
  const spreadsheetId = parseSpreadsheetId(urlOrId);
  if (!spreadsheetId) throw new Error("No pudimos reconocer ese link o ID de Google Sheets.");
  const token = await requireReadToken(workspaceId);
  const meta = await fetchSpreadsheetMetadata(token, spreadsheetId);
  return { spreadsheetId, title: meta.title, tabs: meta.sheets.map((s) => ({ title: s.title, gid: String(s.sheetId) })) };
}

/** La fila de títulos real suele no ser la 1 (título "AGENDAS" arriba, etc.): se elige la que más
 * celdas con texto tiene entre las primeras 10, mismo criterio que inspectAdvisorSheetColumnsAction. */
function detectHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const count = (rows[i] ?? []).filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
    if (count > bestCount) {
      bestCount = count;
      best = i;
    }
  }
  return best + 1;
}

export async function inspectAgendaSheetTabAction(input: { spreadsheetId: string; sheetName: string; headerRow?: number }): Promise<AgendaSheetTabInspection> {
  const workspaceId = await requireAgendaWorkspace();
  const token = await requireReadToken(workspaceId);
  const rows = await fetchSheetValues(token, input.spreadsheetId, input.sheetName);
  const headerRow = input.headerRow && input.headerRow >= 1 ? input.headerRow : detectHeaderRow(rows);
  const headers = (rows[headerRow - 1] ?? []).map((h) => (h === null || h === undefined ? "" : String(h).trim()));
  const suggestions = new Map(detectAdvisorSyncColumnMapping(headers.filter(Boolean)).map((s) => [s.header, s.fieldKey]));
  const dataRows = rows.slice(headerRow);

  const columns = headers
    .map((header, idx) => {
      const distinct = new Set<string>();
      for (const row of dataRows) {
        const v = row?.[idx];
        const text = v === null || v === undefined ? "" : String(v).trim();
        if (text && distinct.size < 60) distinct.add(text);
      }
      return { letter: columnLetter(idx), header, suggestion: suggestions.get(header) ?? null, distinctValues: [...distinct] };
    })
    .filter((c) => c.header);

  return { headerRow, columns, preview: rows.slice(0, Math.max(headerRow + 3, 6)).map((r) => (r ?? []).map((c) => (c === null || c === undefined ? "" : String(c)))) };
}

function validateConfig(config: AgendaSheetConfigInput) {
  const mapped = new Set(Object.values(config.columnMap));
  const required: AdvisorSyncFieldKey[] = ["leadName", "phone", "date"];
  if (required.some((k) => !mapped.has(k))) throw new Error("Mapeá al menos Nombre, Teléfono y Fecha de cita.");
  if (!Number.isInteger(config.headerRow) || config.headerRow < 1) throw new Error("La fila de títulos tiene que ser un número positivo.");
}

/** Vista previa antes de importar: cuántas citas, cuántos leads nuevos/existentes y qué filas
 * tienen problemas — misma interpretación de filas que la sync real (sheetRows.ts). */
export async function previewAgendaSheetImportAction(config: AgendaSheetConfigInput): Promise<AgendaSheetPreview> {
  const workspaceId = await requireAgendaWorkspace();
  validateConfig(config);
  const token = await requireReadToken(workspaceId);
  const rows = await fetchSheetValues(token, config.spreadsheetId, config.sheetName);
  const { items } = parseAgendaSheetRows(rows, config.headerRow, config.columnMap, config.utcOffsetMinutes);

  const importable = items.filter((i) => i.key);
  const phones = [...new Set(importable.map((i) => i.digits))];
  const existing = new Set<string>();
  if (phones.length > 0) {
    const service = createServiceRoleClient();
    const candidateToDigits = new Map<string, string>();
    for (const d of phones) for (const c of phoneLookupCandidates(d)) candidateToDigits.set(c, d);
    const all = [...candidateToDigits.keys()];
    for (let i = 0; i < all.length; i += 300) {
      const { data } = await service.from("contacts").select("phone").eq("workspace_id", workspaceId).in("phone", all.slice(i, i + 300));
      for (const r of data ?? []) {
        const d = candidateToDigits.get(r.phone as string) ?? candidateToDigits.get(phoneDigits(r.phone as string));
        if (d) existing.add(d);
      }
    }
  }

  return {
    citas: importable.length,
    nuevosLeads: phones.filter((p) => !existing.has(p)).length,
    leadsExistentes: phones.filter((p) => existing.has(p)).length,
    sinHora: importable.filter((i) => i.parsed?.sinHora).length,
    problems: items.filter((i) => i.problems.length > 0).map((i) => ({ rowNumber: i.rowNumber, name: i.values.leadName ?? "(sin nombre)", problems: i.problems })),
  };
}

/** "Importar y sincronizar": guarda la configuración (una conexión propia por workspace) y corre
 * la primera sincronización en el acto. */
export async function saveAgendaSheetAndSyncAction(config: AgendaSheetConfigInput): Promise<AdvisorSyncResult> {
  const workspaceId = await requireAgendaWorkspace();
  validateConfig(config);
  const supabase = await createClient();

  const payload = {
    workspace_id: workspaceId,
    advisor_client_id: null,
    spreadsheet_id: config.spreadsheetId,
    spreadsheet_title: config.spreadsheetTitle || null,
    sheet_gid: config.sheetGid,
    sheet_name: config.sheetName,
    header_row: config.headerRow,
    column_map: config.columnMap,
    value_map: config.valueMap satisfies ValueMap,
    options: config.options,
    utc_offset_minutes: Math.max(-840, Math.min(840, Math.round(config.utcOffsetMinutes))),
    status: "active",
    // Configuración nueva → la próxima sync re-procesa todas las filas.
    last_sheet_hash: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase.from("advisor_sheet_connections").select("id").eq("workspace_id", workspaceId).is("advisor_client_id", null).maybeSingle();
  const { data, error } = existing
    ? await supabase.from("advisor_sheet_connections").update(payload).eq("id", existing.id as string).select("*").single()
    : await supabase.from("advisor_sheet_connections").insert(payload).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo guardar la conexión con la hoja.");

  const result = await runAdvisorSheetSync(toAdvisorSheetConnection(data), "manual");
  revalidatePath("/agenda");
  revalidatePath("/profile");
  return result;
}

/** Botón "Actualizar" / "Sincronizar ahora" — la única forma de sincronizar (sin cron). */
export async function syncAgendaSheetNowAction(): Promise<AdvisorSyncResult> {
  const workspaceId = await requireAgendaWorkspace();
  const supabase = await createClient();
  const { data } = await supabase.from("advisor_sheet_connections").select("*").eq("workspace_id", workspaceId).is("advisor_client_id", null).maybeSingle();
  if (!data) throw new Error("Todavía no conectaste tu hoja de agendas.");
  const result = await runAdvisorSheetSync(toAdvisorSheetConnection(data), "manual");
  revalidatePath("/agenda");
  return result;
}

/** Sección "Leads" de la Agenda: cada persona de la hoja queda guardada como lead (contacto) con
 * sus citas — pedido explícito: "tiene que tener un apartado en la agenda donde quede guardado". */
export async function getAgendaLeadsAction(): Promise<AgendaLead[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "agenda");
  const memberId = await getCurrentMemberId(workspaceId);
  return getAgendaLeads(workspaceId, { memberId, role });
}
