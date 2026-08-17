import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientAppointments, getClientNotes, getClientProfile, getClientSetterPerformance } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import {
  getClientAsesorias,
  getClientReferrals,
  getClientMiniApps,
  getClientRecentMiniAppLeads,
  getClientOperacionModules,
} from "@/lib/clients/operacion";
import { OperacionShell } from "./OperacionShell";

export const metadata: Metadata = { title: "Operación — Cliente — Growth Link" };

/** Centro de supervisión operacional del asesor — citas, asesorías,
 * referidos y Mini Apps, todo leído del workspace REAL del asesor
 * (linkedWorkspaceId, resuelto internamente por cada función de
 * src/lib/clients/operacion.ts) sin llevar al owner/admin a ese workspace.
 * Un solo fetch acá; OperacionShell (client) maneja sub-tabs/filtros sin
 * volver a pedirle nada al servidor salvo los drawers de detalle. */
export default async function ClientOperacionPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const client = await getClientProfile(workspaceId, clientId);
  if (!client) return null;

  const [appointments, members, setters, notes, asesorias, referrals, miniApps, recentMiniAppLeads, modules] = await Promise.all([
    getClientAppointments(workspaceId, clientId),
    getWorkspaceMembers(client.linkedWorkspaceId ?? workspaceId),
    getClientSetterPerformance(workspaceId, clientId),
    getClientNotes(workspaceId, clientId),
    getClientAsesorias(workspaceId, clientId),
    getClientReferrals(workspaceId, clientId),
    getClientMiniApps(workspaceId, clientId),
    getClientRecentMiniAppLeads(workspaceId, clientId),
    getClientOperacionModules(workspaceId, clientId),
  ]);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));

  return (
    <OperacionShell
      clientId={clientId}
      appointments={appointments}
      notes={notes}
      setters={setters}
      nameById={nameById}
      asesorias={asesorias}
      referrals={referrals}
      miniApps={miniApps}
      recentMiniAppLeads={recentMiniAppLeads}
      modules={modules}
    />
  );
}
