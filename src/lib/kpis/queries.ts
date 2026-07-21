import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_KPI_TOTALS, sumKpiTotals, type KpiTotals } from "@/lib/kpis/formulas";

export interface KpiSetterOption {
  id: string;
  displayName: string;
  linkedMemberId: string | null;
  teamId: string | null;
}

/** For filter dropdowns (Setter/Equipo) — Equipo only applies to setters
 * linked to a real workspace_members row (linked_member_id), since a
 * plain sheet-only setter has no team assignment. */
export async function getKpiSetterOptions(workspaceId: string): Promise<KpiSetterOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kpi_setters")
    .select("id, display_name, linked_member_id, workspace_members(team_id)")
    .eq("workspace_id", workspaceId)
    .order("display_name", { ascending: true });

  return (data ?? []).map((row) => {
    const member = Array.isArray(row.workspace_members) ? row.workspace_members[0] : row.workspace_members;
    return {
      id: row.id as string,
      displayName: row.display_name as string,
      linkedMemberId: row.linked_member_id as string | null,
      teamId: (member?.team_id as string | undefined) ?? null,
    };
  });
}

export interface KpiSetterSheetInfo {
  id: string;
  displayName: string;
  spreadsheetId: string | null;
  sheetName: string | null;
  status: "active" | "inactive";
  lastSyncedAt: string | null;
  lastSyncStatus: "pending" | "ok" | "error";
  lastSyncError: string | null;
  rowCount: number;
}

/** One Google Sheet per setter (confirmed with the user) — this is the list
 * the Configuración → Integraciones screen manages (add a setter, paste
 * their sheet link, see per-setter sync status), replacing the single
 * workspace-level "one spreadsheet" model this module started with. */
export async function getKpiSetterSheets(workspaceId: string): Promise<KpiSetterSheetInfo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kpi_setters")
    .select("id, display_name, spreadsheet_id, sheet_name, status, last_synced_at, last_sync_status, last_sync_error, row_count")
    .eq("workspace_id", workspaceId)
    .order("display_name", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    displayName: row.display_name as string,
    spreadsheetId: row.spreadsheet_id as string | null,
    sheetName: row.sheet_name as string | null,
    status: row.status as "active" | "inactive",
    lastSyncedAt: row.last_synced_at as string | null,
    lastSyncStatus: row.last_sync_status as "pending" | "ok" | "error",
    lastSyncError: row.last_sync_error as string | null,
    rowCount: row.row_count as number,
  }));
}

/** Gates the KPIs tab's EmptyState: real data only once at least one setter
 * has a working sheet configured (matches the account being connected but
 * having zero setters set up yet — a distinct, more specific empty state
 * than "no Google account connected at all"). */
export async function hasAnyKpiSetterSheet(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("kpi_setters")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("spreadsheet_id", "is", null);
  return (count ?? 0) > 0;
}

export interface KpiEntryRow extends KpiTotals {
  setterId: string;
  setterName: string;
  periodMonth: string;
  weekNumber: number;
}

interface KpiEntryFilters {
  periodMonth: string; // ISO first-of-month
  weekNumber?: number;
  setterId?: string;
  teamId?: string;
}

/** Core read for the whole KPIs screen — one query, then the UI derives
 * weekly/monthly views, charts and ranking from the same rows client-side
 * (via src/lib/kpis/formulas.ts) so a single sync is reflected consistently
 * everywhere instead of running slightly different aggregations per view. */
export async function getKpiEntries(workspaceId: string, filters: KpiEntryFilters): Promise<KpiEntryRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("kpi_entries")
    .select(
      "week_number, period_month, conexion, conexiones_aceptadas, respuestas_primer_mensaje, primer_mensaje_enviado, en_conversacion, no_le_interesa, seguimiento_conversacion, seguimiento_agenda, agenda_manual, calificadas, kpi_setters!inner(id, display_name, linked_member_id, workspace_members(team_id))",
    )
    .eq("workspace_id", workspaceId)
    .eq("period_month", filters.periodMonth)
    .eq("is_stale", false);

  if (filters.weekNumber) query = query.eq("week_number", filters.weekNumber);
  if (filters.setterId) query = query.eq("setter_id", filters.setterId);

  const { data } = await query;

  return (data ?? [])
    .map((row) => {
      const setter = Array.isArray(row.kpi_setters) ? row.kpi_setters[0] : row.kpi_setters;
      const member = Array.isArray(setter?.workspace_members) ? setter.workspace_members[0] : setter?.workspace_members;
      return {
        setterId: setter?.id as string,
        setterName: setter?.display_name as string,
        periodMonth: row.period_month as string,
        weekNumber: row.week_number as number,
        conexion: row.conexion as number,
        conexionesAceptadas: row.conexiones_aceptadas as number,
        respuestasPrimerMensaje: row.respuestas_primer_mensaje as number,
        primerMensajeEnviado: row.primer_mensaje_enviado as number,
        enConversacion: row.en_conversacion as number,
        noLeInteresa: row.no_le_interesa as number,
        seguimientoConversacion: row.seguimiento_conversacion as number,
        seguimientoAgenda: row.seguimiento_agenda as number,
        agendaManual: row.agenda_manual as number,
        calificadas: row.calificadas as number,
        _teamId: (member?.team_id as string | undefined) ?? null,
      };
    })
    .filter((row) => !filters.teamId || row._teamId === filters.teamId)
    .map((row) => {
      const { _teamId, ...rest } = row;
      void _teamId;
      return rest;
    });
}

export function totalsFromEntries(entries: KpiTotals[]): KpiTotals {
  return entries.length === 0 ? EMPTY_KPI_TOTALS : sumKpiTotals(entries);
}

export interface KpiRankingRow {
  setterId: string;
  setterName: string;
  conexion: number;
  agendasCount: number;
  calificadas: number;
  conversion: number;
}

export interface KpiGoal {
  metricKey: string;
  targetValue: number;
}

export async function getKpiGoals(workspaceId: string, periodMonth: string): Promise<KpiGoal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kpi_goals")
    .select("metric_key, target_value")
    .eq("workspace_id", workspaceId)
    .eq("period_month", periodMonth);

  return (data ?? []).map((g) => ({ metricKey: g.metric_key as string, targetValue: g.target_value as number }));
}
