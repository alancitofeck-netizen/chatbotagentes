import type { Metadata } from "next";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getDocumentsByRelated } from "@/lib/documents/queries";
import { ClientDocumentsPanel } from "./ClientDocumentsPanel";

export const metadata: Metadata = { title: "Documentos — Cliente — Growth Link" };

export default async function ClientDocumentosPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const documents = await getDocumentsByRelated(workspaceId, memberId, "client", clientId);

  return <ClientDocumentsPanel clientId={clientId} initialDocuments={documents} />;
}
