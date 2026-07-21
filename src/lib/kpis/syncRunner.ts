import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getValidGoogleSheetsAccessToken, fetchSheetValues } from "@/lib/integrations/googleSheets";
import { parseKpiSheet } from "@/lib/kpis/sync";

export interface KpiSyncResult {
  setterId: string;
  ok: boolean;
  rowsRead: number;
  weeksWritten: number;
  skippedRows: number;
  error?: string;
}

/**
 * Orchestrates one setter's sync: resolve the workspace's Google token
 * (setters don't have their own OAuth — they share their sheet with the
 * single workspace-level connected account, confirmed as the preferred
 * model) → fetch that setter's sheet → pure parse/aggregate
 * (src/lib/kpis/sync.ts) → upsert kpi_entries per (month, week) bucket →
 * mark buckets not touched by this run as stale → update kpi_setters'
 * status/row_count/last_sync_error. Called from both the cron route
 * (src/app/api/cron/sync-kpis/route.ts) and the manual "Sincronizar ahora"
 * action — same function either way.
 *
 * Never throws — always returns a result object (Promise.allSettled-safe),
 * matching the resilience convention already established for
 * pushEventToGoogle (src/lib/integrations/googleCalendar.ts).
 */
export async function runKpiSyncForSetter(
  workspaceId: string,
  setter: { id: string; spreadsheetId: string; sheetName: string | null },
): Promise<KpiSyncResult> {
  const supabase = createServiceRoleClient();
  const startedAt = new Date().toISOString();

  try {
    const accessToken = await getValidGoogleSheetsAccessToken(workspaceId);
    if (!accessToken) {
      throw new Error("Conexión de Google Sheets no disponible para este workspace (token ausente o revocado).");
    }

    const sheetName = setter.sheetName ?? "Hoja 1";
    const values = await fetchSheetValues(accessToken, setter.spreadsheetId, sheetName);
    const parsed = parseKpiSheet(values);

    let weeksWritten = 0;
    for (const bucket of parsed.buckets) {
      const { error } = await supabase.from("kpi_entries").upsert(
        {
          workspace_id: workspaceId,
          setter_id: setter.id,
          period_month: bucket.periodMonth,
          week_number: bucket.weekNumber,
          conexion: bucket.conexion,
          conexiones_aceptadas: bucket.conexionesAceptadas,
          respuestas_primer_mensaje: bucket.respuestasPrimerMensaje,
          primer_mensaje_enviado: bucket.primerMensajeEnviado,
          en_conversacion: bucket.enConversacion,
          no_le_interesa: bucket.noLeInteresa,
          seguimiento_conversacion: bucket.seguimientoConversacion,
          seguimiento_agenda: bucket.seguimientoAgenda,
          agenda_manual: bucket.agendaManual,
          calificadas: bucket.calificadas,
          source_row_hash: bucket.sourceRowHash,
          is_stale: false,
          synced_at: startedAt,
        },
        { onConflict: "workspace_id,period_month,week_number,setter_id" },
      );
      if (error) throw new Error(`No se pudo guardar la semana ${bucket.weekNumber} (${bucket.periodMonth}): ${error.message}`);
      weeksWritten += 1;
    }

    // Weeks that existed before this run but weren't touched by it (e.g. the
    // setter's sheet no longer covers that period) get marked stale — never
    // hard-deleted, per the "guardar histórico" requirement.
    await supabase
      .from("kpi_entries")
      .update({ is_stale: true })
      .eq("workspace_id", workspaceId)
      .eq("setter_id", setter.id)
      .lt("synced_at", startedAt);

    await supabase
      .from("kpi_setters")
      .update({ last_sync_status: "ok", last_sync_error: null, row_count: values.length - 1, column_map: parsed.columnMap })
      .eq("id", setter.id);

    return { setterId: setter.id, ok: true, rowsRead: values.length - 1, weeksWritten, skippedRows: parsed.skippedRows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido durante la sincronización.";
    console.error(`[kpis-sync] failed for setter ${setter.id}:`, err);
    await supabase.from("kpi_setters").update({ last_sync_status: "error", last_sync_error: message }).eq("id", setter.id);
    return { setterId: setter.id, ok: false, rowsRead: 0, weeksWritten: 0, skippedRows: 0, error: message };
  }
}
