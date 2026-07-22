import type { Metadata } from "next";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { getDocuments, getFolderTree } from "@/lib/documents/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getGoogleDriveStatus } from "@/lib/integrations/googleDrive";
import { DocumentsShell } from "./DocumentsShell";

export const metadata: Metadata = {
  title: "Documentos — Growth Link",
};

export default async function DocumentsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);

  const [documents, folders, members, googleDrive] = await Promise.all([
    getDocuments(workspaceId, memberId, { view: "all", folderId: null }),
    getFolderTree(workspaceId),
    getWorkspaceMembers(workspaceId),
    getGoogleDriveStatus(workspaceId),
  ]);

  return (
    <DocumentsShell
      workspaceId={workspaceId}
      initialDocuments={documents}
      initialFolders={folders}
      members={members}
      ownMemberId={memberId}
      googleDriveConnected={googleDrive.connected}
    />
  );
}
