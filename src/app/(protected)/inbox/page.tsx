import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getConversationList, getWorkspaceMembers, getWorkspaceTags } from "@/lib/inbox/queries";
import { getTemplateList } from "@/lib/templates/queries";
import { InboxShell } from "./InboxShell";

export const metadata: Metadata = {
  title: "Inbox — Growth Link",
};

export default async function InboxPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const currentMemberId = await getCurrentMemberId(workspaceId);
  const [conversations, members, tags, templates] = await Promise.all([
    getConversationList(workspaceId, {}, currentMemberId),
    getWorkspaceMembers(workspaceId),
    getWorkspaceTags(workspaceId),
    getTemplateList(workspaceId),
  ]);

  return (
    <InboxShell
      workspaceId={workspaceId}
      currentMemberId={currentMemberId}
      initialConversations={conversations}
      members={members}
      tags={tags}
      approvedTemplates={templates.filter((t) => t.status === "approved")}
    />
  );
}
