import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import {
  getAdvisorPolicyOptions,
  getContactOptions,
  getConversationOptions,
  getDocumentOptions,
  getEventOptions,
  getTaskDetail,
} from "@/lib/tasks/queries";
import { getOpportunityOptions } from "@/lib/crm/queries";
import { TaskDetailShell } from "./TaskDetailShell";

export const metadata: Metadata = {
  title: "Tarea — Growth Link",
};

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);

  const task = await getTaskDetail(workspaceId, taskId);
  if (!task) notFound();

  const [members, contactOptions, conversationOptions, opportunityOptions, advisorPolicyOptions, eventOptions, documentOptions] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    getContactOptions(workspaceId),
    getConversationOptions(workspaceId),
    getOpportunityOptions(workspaceId),
    getAdvisorPolicyOptions(workspaceId),
    getEventOptions(workspaceId),
    getDocumentOptions(workspaceId),
  ]);

  return (
    <TaskDetailShell
      initialTask={task}
      workspaceId={workspaceId}
      members={members}
      contactOptions={contactOptions}
      conversationOptions={conversationOptions}
      opportunityOptions={opportunityOptions}
      advisorPolicyOptions={advisorPolicyOptions}
      eventOptions={eventOptions}
      documentOptions={documentOptions}
      canAssignOthers={role === "owner" || role === "admin"}
      ownMemberId={ownMemberId}
    />
  );
}
