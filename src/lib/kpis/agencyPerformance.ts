import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getRealAdvisorWorkspaces } from "@/lib/clients/queries";
import type { KpiTotals } from "@/lib/kpis/formulas";

/** Capa de datos "Asesores → Performance" — agrega kpi_setters/kpi_entries
 * CROSS todos los asesores reales gestionados por la agencia, mismo patrón
 * ya resuelto por getAgendaPerformance (src/lib/agenda/queries.ts) para
 * citas: service-role + .in("workspace_id", linkedWorkspaceIds), porque acá
 * SIEMPRE es una lectura cross-tenant (a diferencia de getKpiEntries, que
 * lee un solo workspace con el cliente de sesión normal). No se toca la
 * sincronización ni el módulo /kpis original — esto es una vista agregada
 * de solo lectura sobre las mismas tablas. */

export interface AgencyKpiEntryRow extends KpiTotals {
  setterId: string;
  setterName: string;
  teamId: string | null;
  advisorWorkspaceId: string;
  advisorName: string;
  periodMonth: string;
  weekNumber: number;
}

export interface AgencyAdvisorOption {
  workspaceId: string;
  name: string;
}

export interface AgencyTeamOption {
  id: string;
  name: string;
}

/** Todos los asesores reales de la agencia — mismo origen que ya usa
 * asesores/page.tsx (getClientsList → getRealAdvisorWorkspaces). */
export async function getAgencyAdvisorOptions(): Promise<AgencyAdvisorOption[]> {
  const advisors = await getRealAdvisorWorkspaces();
  return advisors.map((a) => ({ workspaceId: a.workspaceId, name: a.name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Un solo query cross-tenant para varios meses a la vez — de acá se derivan
 * en memoria (client-side) el ranking, las comparativas semana/mes anterior
 * y la evolución histórica, mismo criterio que ya documenta getKpiEntries
 * ("un solo fetch, el resto se deriva"). `periodMonths` en ISO primer-día-de-mes. */
export async function getAgencyKpiEntries(periodMonths: string[]): Promise<AgencyKpiEntryRow[]> {
  const advisors = await getRealAdvisorWorkspaces();
  if (advisors.length === 0 || periodMonths.length === 0) return [];
  const nameByWorkspace = new Map(advisors.map((a) => [a.workspaceId, a.name]));
  const linkedWorkspaceIds = advisors.map((a) => a.workspaceId);

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("kpi_entries")
    .select(
      "workspace_id, week_number, period_month, conexion, conexiones_aceptadas, respuestas_primer_mensaje, primer_mensaje_enviado, en_conversacion, no_le_interesa, seguimiento_conversacion, seguimiento_agenda, agenda_manual, calificadas, kpi_setters!inner(id, display_name, linked_member_id, workspace_members(team_id))",
    )
    .in("workspace_id", linkedWorkspaceIds)
    .in("period_month", periodMonths)
    .eq("is_stale", false);

  return (data ?? []).map((row) => {
    const setter = Array.isArray(row.kpi_setters) ? row.kpi_setters[0] : row.kpi_setters;
    const member = Array.isArray(setter?.workspace_members) ? setter.workspace_members[0] : setter?.workspace_members;
    const advisorWorkspaceId = row.workspace_id as string;
    return {
      setterId: setter?.id as string,
      setterName: setter?.display_name as string,
      teamId: (member?.team_id as string | undefined) ?? null,
      advisorWorkspaceId,
      advisorName: nameByWorkspace.get(advisorWorkspaceId) ?? "—",
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
    };
  });
}

/** Equipos de TODOS los workspaces de asesores, para el filtro "Equipo" —
 * mismo criterio que getKpiSetterOptions pero cross-tenant (service-role,
 * un query por workspace es aceptable acá porque son pocos asesores). */
export async function getAgencyTeamOptions(): Promise<AgencyTeamOption[]> {
  const advisors = await getRealAdvisorWorkspaces();
  if (advisors.length === 0) return [];
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, workspace_id")
    .in("workspace_id", advisors.map((a) => a.workspaceId));
  const seen = new Map<string, string>();
  for (const t of data ?? []) seen.set(t.id as string, t.name as string);
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

