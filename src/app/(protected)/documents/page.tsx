import type { Metadata } from "next";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getDocuments, getFolderTree } from "@/lib/documents/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { DocumentsShell } from "./DocumentsShell";

export const metadata: Metadata = {
  title: "Documentos — Growth Link",
};

export default async function DocumentsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);

  const [documents, folders, members] = await Promise.all([
    getDocuments(workspaceId, memberId, { view: "all", folderId: null }),
    getFolderTree(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);

  return (
    <DocumentsShell
      workspaceId={workspaceId}
      initialDocuments={documents}
      initialFolders={folders}
      members={members}
      ownMemberId={memberId}
    />
  );
}
