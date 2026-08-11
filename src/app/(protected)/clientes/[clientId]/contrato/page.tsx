import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientContracts, getClientContractPayments, getClientNotes, getClientTimeline } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { ContractPanel } from "./ContractPanel";
import { ContractPaymentsPanel } from "./ContractPaymentsPanel";
import { ContractNotesPanel } from "./ContractNotesPanel";

export const metadata: Metadata = { title: "Contrato — Cliente — Growth Link" };

export default async function ClientContratoPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const [contracts, notes, timeline, members] = await Promise.all([
    getClientContracts(workspaceId, clientId),
    getClientNotes(workspaceId, clientId),
    getClientTimeline(workspaceId, clientId),
    getWorkspaceMembers(workspaceId),
  ]);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const active = contracts.find((c) => c.status === "activo") ?? contracts[0] ?? null;
  const payments = active ? await getClientContractPayments(workspaceId, active.id) : [];

  return (
    <div className="flex flex-col gap-4">
      <ContractPanel clientId={clientId} contracts={contracts} timeline={timeline} nameById={nameById} />
      {active && <ContractPaymentsPanel contractId={active.id} clientId={clientId} currency={active.currency} initialPayments={payments} />}
      <ContractNotesPanel clientId={clientId} initialNotes={notes} nameById={nameById} />
    </div>
  );
}
