import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getContactOptions, getConversationOptions, getTasksByGroup } from "@/lib/tasks/queries";
import { getGroupStats, getTaskGroupById } from "@/lib/tasks/groups/queries";
import { GroupDetailShell } from "./GroupDetailShell";

export async function generateMetadata({ params }: { params: Promise<{ groupId: string }> }): Promise<Metadata> {
  const { groupId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const group = await getTaskGroupById(workspaceId, groupId);
  return { title: group ? `${group.name} — Growth Link` : "Grupo — Growth Link" };
}

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);

  const group = await getTaskGroupById(workspaceId, groupId);
  if (!group) notFound();

  const [tasks, stats, members, contactOptions, conversationOptions] = await Promise.all([
    getTasksByGroup(workspaceId, groupId),
    getGroupStats(workspaceId, groupId),
    getWorkspaceMembers(workspaceId),
    getContactOptions(workspaceId),
    getConversationOptions(workspaceId),
  ]);

  return (
    <GroupDetailShell
      group={group}
      stats={stats}
      initialTasks={tasks}
      members={members}
      contactOptions={contactOptions}
      conversationOptions={conversationOptions}
      canAssignOthers={role === "owner" || role === "admin"}
      ownMemberId={ownMemberId}
    />
  );
}
