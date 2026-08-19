import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireAgencyWorkspaceAccess } from "@/lib/auth/roles";
import { getClientAccess, getClientProfile } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { ClientAccessPanel } from "./ClientAccessPanel";

export const metadata: Metadata = { title: "Accesos — Cliente — Growth Link" };

export default async function ClientAccesosPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireActiveWorkspace();
  const workspaceId = await requireAgencyWorkspaceAccess();
  const [client, access, members] = await Promise.all([
    getClientProfile(workspaceId, clientId),
    getClientAccess(workspaceId, clientId),
    getWorkspaceMembers(workspaceId),
  ]);
  if (!client) return null;

  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const shared = [
    client.setterId ? { role: "Setter", name: nameById.get(client.setterId) } : null,
    client.trafficManagerId ? { role: "Traffic Manager", name: nameById.get(client.trafficManagerId) } : null,
    client.accountManagerId ? { role: "Account Manager", name: nameById.get(client.accountManagerId) } : null,
  ].filter((x): x is { role: string; name: string | undefined } => x !== null);

  return <ClientAccessPanel clientId={clientId} initialAccess={access} shared={shared} />;
}
