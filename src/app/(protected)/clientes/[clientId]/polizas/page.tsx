import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientPolicies, getClientUpcomingPolicyPayments, getClientProfile } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { ClientPoliciesShell } from "./ClientPoliciesShell";

export const metadata: Metadata = { title: "Pólizas — Cliente — Growth Link" };

/** Reutiliza policies.client_id (0125) — mismas filas que ya administra el
 * módulo Pólizas, nunca una copia. */
export default async function ClientPolizasPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const [client, policies, upcomingPayments, members] = await Promise.all([
    getClientProfile(workspaceId, clientId),
    getClientPolicies(workspaceId, clientId),
    getClientUpcomingPolicyPayments(workspaceId, clientId),
    getWorkspaceMembers(workspaceId),
  ]);
  if (!client) return null;

  return <ClientPoliciesShell clientId={clientId} client={client} initialPolicies={policies} upcomingPayments={upcomingPayments} members={members} />;
}
