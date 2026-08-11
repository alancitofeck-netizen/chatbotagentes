import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientContracts } from "@/lib/clients/queries";
import { ContractPanel } from "./ContractPanel";

export const metadata: Metadata = { title: "Contrato — Cliente — Growth Link" };

export default async function ClientContratoPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const contracts = await getClientContracts(workspaceId, clientId);

  return <ContractPanel clientId={clientId} contracts={contracts} />;
}
