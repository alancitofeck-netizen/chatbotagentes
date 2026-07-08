import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getConversationList, getWorkspaceMembers, getWorkspaceTags } from "@/lib/inbox/queries";
import { InboxShell } from "./InboxShell";

export const metadata: Metadata = {
  title: "Inbox — Growth Link",
};

export default async function InboxPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const [conversations, members, tags] = await Promise.all([
    getConversationList(workspaceId),
    getWorkspaceMembers(workspaceId),
    getWorkspaceTags(workspaceId),
  ]);

  return (
    <InboxShell workspaceId={workspaceId} initialConversations={conversations} members={members} tags={tags} />
  );
}
