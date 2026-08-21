"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole, requireAgencyWorkspaceAccess } from "@/lib/auth/roles";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAgendaAppointments, getAgendaPerformance, updateEstadoCita, type EstadoCita, type AgendaAppointment, type AgendaPerformance } from "./queries";

/** Cualquier miembro del workspace puede pedir su agenda — el filtro
 * "solo mis citas si sos setter" vive dentro de getAgendaAppointments
 * (mismo criterio que /calendar aplica client-side, pero acá server-side
 * porque el dato es cross-tenant y no se puede confiar en que el cliente
 * filtre lo que ya recibió). */
export async function getAgendaAppointmentsAction(range: { start: string; end: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "agenda");
  const memberId = await getCurrentMemberId(workspaceId);
  return getAgendaAppointments(workspaceId, range, { memberId, role });
}

/** KPIs → Agendas es vista de equipo/asesor completo, siempre — gateada a
 * owner/admin (mismo nivel que el resto de Configuración/KPIs). */
export async function getAgendaPerformanceAction(range: { start: string; end: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await assertModuleEnabled(workspaceId, "agenda");
  return getAgendaPerformance(workspaceId, range);
}

/** Asesores → Agendas (vista de listado, cross-asesor) — a diferencia de
 * getAgendaAppointmentsAction/getAgendaPerformanceAction (que resuelven el
 * workspace vía requireActiveWorkspace(), el workspace de SESIÓN activa),
 * acá se resuelve vía requireAgencyWorkspaceAccess() (por usuario, no por
 * sesión activa) — mismo bug de "workspace de sesión ≠ workspace de
 * agencia" ya corregido dos veces esta sesión en la ficha del asesor, ahora
 * evitado de raíz. Usada por AgendasShell para recargar al cambiar de
 * semana/mes/rango personalizado (el fetch inicial va directo por
 * page.tsx → queries.ts, sin pasar por acá). */
export async function getAgencyAgendaDataAction(range: { start: string; end: string }): Promise<{ appointments: AgendaAppointment[]; performance: AgendaPerformance }> {
  const agencyWorkspaceId = await requireAgencyWorkspaceAccess();
  const memberId = await getCurrentMemberId(agencyWorkspaceId);
  // requireAgencyWorkspaceAccess ya garantiza owner/admin (nunca "agent"),
  // que es el único valor de role que getAgendaAppointments mira — el
  // literal "owner" es una simplificación segura, no distingue admin.
  const [appointments, performance] = await Promise.all([
    getAgendaAppointments(agencyWorkspaceId, range, { memberId, role: "owner" }),
    getAgendaPerformance(agencyWorkspaceId, range),
  ]);
  return { appointments, performance };
}

/** Disponible para los 3 roles — la autorización real (a qué citas puede
 * tocar cada uno) vive en updateEstadoCita (agenda/queries.ts). */
export async function updateEstadoCitaAction(appointmentId: string, appointmentWorkspaceId: string, estadoCita: EstadoCita) {
  const { workspaceId, role } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "agenda");
  const memberId = await getCurrentMemberId(workspaceId);
  await updateEstadoCita(workspaceId, appointmentId, appointmentWorkspaceId, estadoCita, { memberId, role });
  revalidatePath("/agenda");
}
