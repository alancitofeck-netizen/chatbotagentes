import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getValidGoogleSheetsExportAccessToken,
  fetchSpreadsheetMetadata,
  fetchColumnValues,
  writeRowValues,
  writeCellValue,
  insertBlankRow,
} from "@/lib/integrations/googleSheetsExport";
import type { ReferralStatus } from "@/lib/asesorias/referrals";

interface ColumnMap {
  numero: string;
  lead: string;
  nombre: string;
  telefono: string;
  agendo: string;
}

interface Connection {
  id: string;
  workspace_id: string;
  spreadsheet_id: string;
  sheet_name: string;
  start_row: number;
  column_map: ColumnMap;
  status: string;
}

interface ReferralRecord {
  id: string;
  asesoria_id: string | null;
  name: string;
  phone: string;
  status: ReferralStatus;
}

function agendoValue(status: ReferralStatus): string {
  return status === "cita_agendada" ? "Sí" : "";
}

/** Mismo nombre que resuelve getWorkspaceReferrals (referrals.ts) como
 * "Lead" (contacts(name) si hay contacto vinculado, si no asesorias.name,
 * "Prospecto" si no hay ninguno) — resuelto acá con una consulta liviana de
 * una sola fila en vez de traer la lista completa de asesorías. */
async function resolveLeadName(supabase: ReturnType<typeof createServiceRoleClient>, asesoriaId: string): Promise<string> {
  const { data } = await supabase.from("asesorias").select("name, contacts(name)").eq("id", asesoriaId).maybeSingle();
  const contactName = (data?.contacts as { name: string } | { name: string }[] | null | undefined) ?? null;
  const resolvedContactName = Array.isArray(contactName) ? contactName[0]?.name : contactName?.name;
  return resolvedContactName ?? (data?.name as string | undefined) ?? "Prospecto";
}

async function resolveSheetGid(accessToken: string, connection: Connection): Promise<number | null> {
  const meta = await fetchSpreadsheetMetadata(accessToken, connection.spreadsheet_id);
  return meta.sheets.find((s) => s.title === connection.sheet_name)?.sheetId ?? null;
}

/** Fila del último referido ya exportado para este mismo lead (misma
 * asesoria_id), si hay alguno — para insertar el grupo nuevo justo debajo
 * en vez de al final de la hoja. */
async function findLastRowForLead(supabase: ReturnType<typeof createServiceRoleClient>, connectionId: string, asesoriaId: string, excludeReferralId: string): Promise<number | null> {
  const { data: siblingReferrals } = await supabase.from("asesoria_referrals").select("id").eq("asesoria_id", asesoriaId).neq("id", excludeReferralId);
  const siblingIds = (siblingReferrals ?? []).map((r) => r.id as string);
  if (siblingIds.length === 0) return null;

  const { data: exports } = await supabase
    .from("referral_sheet_exports")
    .select("sheet_row_number")
    .eq("connection_id", connectionId)
    .in("referral_id", siblingIds)
    .not("sheet_row_number", "is", null)
    .order("sheet_row_number", { ascending: false })
    .limit(1);

  return (exports?.[0]?.sheet_row_number as number | undefined) ?? null;
}

/** Primera fila libre (columna "nombre" vacía desde start_row) y próximo
 * número de asesoría (máximo de la columna "numero" + 1, o 1 si está
 * vacía) — usado solo cuando el lead no tiene ningún referido ya
 * exportado (primera fila de un grupo nuevo). */
async function findNextExportPosition(
  accessToken: string,
  connection: Connection,
): Promise<{ row: number; nextNumero: number }> {
  const [nombreColumn, numeroColumn] = [connection.column_map.nombre, connection.column_map.numero];
  const [nombreValues, numeroValues] = await Promise.all([
    fetchColumnValues(accessToken, connection.spreadsheet_id, connection.sheet_name, nombreColumn, connection.start_row),
    fetchColumnValues(accessToken, connection.spreadsheet_id, connection.sheet_name, numeroColumn, connection.start_row),
  ]);

  let row = connection.start_row;
  for (const value of nombreValues) {
    if (value === "") break;
    row++;
  }

  const numbers = numeroValues.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  const nextNumero = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

  return { row, nextNumero };
}

async function markConnectionResult(supabase: ReturnType<typeof createServiceRoleClient>, connectionId: string, result: { ok: true } | { ok: false; error: string }) {
  if (result.ok) {
    await supabase.from("referral_sheet_connections").update({ last_sync_status: "ok", last_sync_error: null, last_synced_at: new Date().toISOString() }).eq("id", connectionId);
  } else {
    await supabase.from("referral_sheet_connections").update({ last_sync_status: "error", last_sync_error: result.error, last_synced_at: new Date().toISOString() }).eq("id", connectionId);
  }
}

/** Exporta (o actualiza) UN referido a la hoja configurada del workspace.
 * Nunca lanza: cualquier error deja el referido "pendiente de exportar" en
 * referral_sheet_exports (last_export_status='pending') para que el botón
 * manual "Exportar a hoja" lo reintente más tarde — sin cron (a pedido del
 * usuario, para no generar tráfico recurrente), así que un fallo queda
 * pendiente hasta la próxima exportación manual, nunca se pierde el dato:
 * el referido ya está guardado en el CRM antes de llegar acá. */
export async function exportReferralToSheet(workspaceId: string, referralId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: connection } = await supabase
    .from("referral_sheet_connections")
    .select("id, workspace_id, spreadsheet_id, sheet_name, start_row, column_map, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  if (!connection) return; // Nada configurado para este workspace — no es un error.
  const conn = connection as Connection;

  const { data: referral } = await supabase.from("asesoria_referrals").select("id, asesoria_id, name, phone, status").eq("id", referralId).eq("workspace_id", workspaceId).maybeSingle();
  if (!referral) return; // Se borró entre que se encoló y se procesó.
  const rec = referral as ReferralRecord;

  const { data: existingExport } = await supabase.from("referral_sheet_exports").select("*").eq("referral_id", referralId).maybeSingle();

  async function fail(error: string) {
    if (existingExport) {
      await supabase.from("referral_sheet_exports").update({ last_export_status: "pending", last_export_error: error }).eq("id", existingExport.id);
    } else {
      await supabase.from("referral_sheet_exports").insert({ connection_id: conn.id, referral_id: referralId, last_export_status: "pending", last_export_error: error });
    }
    await markConnectionResult(supabase, conn.id, { ok: false, error });
  }

  try {
    const accessToken = await getValidGoogleSheetsExportAccessToken(workspaceId);
    if (!accessToken) {
      await fail("Conectá tu cuenta de Google desde Asesorías > Referidos para que se puedan exportar.");
      return;
    }

    // Ya exportado antes — solo hay algo para hacer si cambió el estado.
    if (existingExport && existingExport.last_export_status === "ok" && existingExport.sheet_row_number) {
      if (existingExport.exported_status === rec.status) return; // Nada cambió.

      const nombreValues = await fetchColumnValues(accessToken, conn.spreadsheet_id, conn.sheet_name, conn.column_map.nombre, existingExport.sheet_row_number);
      const telefonoValues = await fetchColumnValues(accessToken, conn.spreadsheet_id, conn.sheet_name, conn.column_map.telefono, existingExport.sheet_row_number);
      const stillMatches = nombreValues[0] === rec.name && telefonoValues[0] === rec.phone;

      if (stillMatches) {
        await writeCellValue(accessToken, conn.spreadsheet_id, conn.sheet_name, conn.column_map.agendo, existingExport.sheet_row_number, agendoValue(rec.status));
        await supabase.from("referral_sheet_exports").update({ exported_status: rec.status, last_export_status: "ok", last_export_error: null, exported_at: new Date().toISOString() }).eq("id", existingExport.id);
        await markConnectionResult(supabase, conn.id, { ok: true });
        return;
      }
      // La fila se movió a mano — se trata como perdida y se re-exporta como si fuera nueva (abajo).
    }

    const sheetGid = await resolveSheetGid(accessToken, conn);
    const leadName = rec.asesoria_id ? await resolveLeadName(supabase, rec.asesoria_id) : "Mini App";

    let targetRow: number;
    let numeroToWrite: number | null = null;

    const lastSiblingRow = rec.asesoria_id ? await findLastRowForLead(supabase, conn.id, rec.asesoria_id, referralId) : null;

    if (lastSiblingRow) {
      targetRow = lastSiblingRow + 1;
      if (sheetGid === null) throw new Error(`No se encontró la pestaña "${conn.sheet_name}" en la hoja.`);
      await insertBlankRow(accessToken, conn.spreadsheet_id, sheetGid, targetRow);
      await writeRowValues(accessToken, conn.spreadsheet_id, conn.sheet_name, conn.column_map.nombre, targetRow, [rec.name, rec.phone, agendoValue(rec.status)]);
    } else {
      const { row, nextNumero } = await findNextExportPosition(accessToken, conn);
      targetRow = row;
      numeroToWrite = nextNumero;
      if (row > conn.start_row) {
        if (sheetGid === null) throw new Error(`No se encontró la pestaña "${conn.sheet_name}" en la hoja.`);
        await insertBlankRow(accessToken, conn.spreadsheet_id, sheetGid, row);
      }
      await writeRowValues(accessToken, conn.spreadsheet_id, conn.sheet_name, conn.column_map.numero, targetRow, [numeroToWrite, leadName, rec.name, rec.phone, agendoValue(rec.status)]);
    }

    if (existingExport) {
      await supabase
        .from("referral_sheet_exports")
        .update({ sheet_row_number: targetRow, exported_status: rec.status, last_export_status: "ok", last_export_error: null, exported_at: new Date().toISOString() })
        .eq("id", existingExport.id);
    } else {
      await supabase.from("referral_sheet_exports").insert({
        connection_id: conn.id,
        referral_id: referralId,
        sheet_row_number: targetRow,
        exported_status: rec.status,
        last_export_status: "ok",
        exported_at: new Date().toISOString(),
      });
    }
    await markConnectionResult(supabase, conn.id, { ok: true });
  } catch (err) {
    await fail(err instanceof Error ? err.message : "Error desconocido al exportar a la hoja.");
  }
}

/** Wrapper fire-and-forget — mismo criterio que el resto del proyecto
 * (ManyChat, auto-start de agentes de referidos, etc.): nunca bloquea ni
 * hace fallar la operación que guardó el referido en el CRM. */
export function triggerReferralExport(workspaceId: string, referralId: string): void {
  exportReferralToSheet(workspaceId, referralId).catch((err) => {
    console.error(`[referral-sheet-export] unexpected failure for referral ${referralId}:`, err);
  });
}
