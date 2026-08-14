"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAgendaAppointments, getAgendaPerformance, updateEstadoCita, type EstadoCita } from "./queries";

/** Cualquier miembro del workspace puede pedir su agenda — el filtro
 * "solo mis citas si sos setter" vive dentro de getAgendaAppointments
 * (mismo criterio que /calendar aplica client-side, pero acá server-side
 * porque el dato es cross-tenant y no se puede confiar en que el cliente
 * filtre lo que ya recibió). */
export async function getAgendaAppointmentsAction(range: { start: string; end: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "asesores");
  const memberId = await getCurrentMemberId(workspaceId);
  return getAgendaAppointments(workspaceId, range, { memberId, role });
}

/** KPIs → Agendas es vista de equipo completo, siempre — gateada a
 * owner/admin (mismo nivel que el resto de Configuración/KPIs). */
export async function getAgendaPerformanceAction(range: { start: string; end: string }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await assertModuleEnabled(workspaceId, "asesores");
  return getAgendaPerformance(workspaceId, range);
}

export async function updateEstadoCitaAction(bookingId: string, bookingWorkspaceId: string, estadoCita: EstadoCita) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await assertModuleEnabled(workspaceId, "asesores");
  await updateEstadoCita(workspaceId, bookingId, bookingWorkspaceId, estadoCita);
  revalidatePath("/crm/agenda");
}
