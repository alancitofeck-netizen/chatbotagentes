import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAgencyWorkspaceAccessForCurrentUser } from "@/lib/auth/roles";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getAgencyAdvisorOptions, getAgencyTeamOptions, getAgencyKpiEntries } from "@/lib/kpis/agencyPerformance";
import { lastNMonths } from "@/lib/kpis/periodHelpers";
import { PerformanceShell } from "./PerformanceShell";

export const metadata: Metadata = { title: "Performance — Asesores — Growth Link" };

/** "Performance": rendimiento real de los setters (hojas de Google Sheets de
 * kpi_setters/kpi_entries) agregado CROSS todos los asesores de la agencia
 * — nunca toca la ficha individual del asesor ni su pestaña "KPIs" (pedido
 * explícito). Un solo fetch de los últimos 7 meses acá; PerformanceShell
 * (client) deriva semana/mes/comparativas/evolución/ranking en memoria, sin
 * volver a pedirle nada al servidor salvo el AI Manager. */
export default async function AsesoresPerformancePage() {
  await requireActiveWorkspace();
  const agencyWorkspaceId = await getAgencyWorkspaceAccessForCurrentUser();
  if (!agencyWorkspaceId) return null;

  const moduleStatus = await getWorkspaceModuleStatus(agencyWorkspaceId);
  const moduleEnabled = moduleStatus.some((m) => m.moduleKey === "asesores" && m.enabled);
  if (!moduleEnabled) return null;

  const [advisors, teams, entries] = await Promise.all([getAgencyAdvisorOptions(), getAgencyTeamOptions(), getAgencyKpiEntries(lastNMonths(7))]);

  return <PerformanceShell advisors={advisors} teams={teams} entries={entries} />;
}
