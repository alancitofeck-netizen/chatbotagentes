import type { Metadata } from "next";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getDocumentsByRelated } from "@/lib/documents/queries";
import { getClientContracts } from "@/lib/clients/queries";
import { contractExpiringSeverity } from "@/lib/clients/alerts";
import { ClientDocumentsPanel } from "./ClientDocumentsPanel";

export const metadata: Metadata = { title: "Documentos — Cliente — Growth Link" };

export default async function ClientDocumentosPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const [documents, contracts] = await Promise.all([
    getDocumentsByRelated(workspaceId, memberId, "client", clientId),
    getClientContracts(workspaceId, clientId),
  ]);

  const expiringContracts = contracts.filter((c) => contractExpiringSeverity(c) !== null).length;

  return <ClientDocumentsPanel clientId={clientId} initialDocuments={documents} contractsCount={contracts.length} contractsExpiringSoon={expiringContracts} />;
}
