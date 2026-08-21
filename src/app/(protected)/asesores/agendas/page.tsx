import type { Metadata } from "next";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getAgencyWorkspaceAccessForCurrentUser } from "@/lib/auth/roles";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getAgendaAppointments, getAgendaPerformance } from "@/lib/agenda/queries";
import { getMonday } from "@/lib/calendar/week";
import { AgendasShell } from "./AgendasShell";

export const metadata: Metadata = { title: "Agendas — Asesores — Growth Link" };

function defaultWeekRange(): { start: string; end: string } {
  const monday = getMonday(new Date());
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return { start: monday.toISOString(), end: nextMonday.toISOString() };
}

/** "Agendas": centro de gestión de citas cross-asesor sobre
 * agenda_appointments (mismo pipeline de Google Sheets KPI que Performance
 * — nunca `bookings`/Google Calendar, que sigue siendo del módulo Calendario
 * y de la ficha del asesor). Igual que Performance, el workspaceId de la
 * agencia se resuelve por USUARIO (getAgencyWorkspaceAccessForCurrentUser),
 * nunca por sesión activa — pasarlo directo a getAgendaAppointments/
 * getAgendaPerformance evita el bug de "workspace de sesión ≠ workspace de
 * agencia" ya corregido dos veces en la ficha del asesor. */
export default async function AsesoresAgendasPage() {
  await requireActiveWorkspace();
  const agencyWorkspaceId = await getAgencyWorkspaceAccessForCurrentUser();
  if (!agencyWorkspaceId) return null;

  const moduleStatus = await getWorkspaceModuleStatus(agencyWorkspaceId);
  const moduleEnabled = moduleStatus.some((m) => m.moduleKey === "asesores" && m.enabled);
  if (!moduleEnabled) return null;

  const range = defaultWeekRange();
  const memberId = await getCurrentMemberId(agencyWorkspaceId);
  const [appointments, performance] = await Promise.all([
    getAgendaAppointments(agencyWorkspaceId, range, { memberId, role: "owner" }),
    getAgendaPerformance(agencyWorkspaceId, range),
  ]);

  return <AgendasShell initialRange={range} initialAppointments={appointments} initialPerformance={performance} />;
}
