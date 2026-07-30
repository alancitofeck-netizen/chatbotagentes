import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getContactOptions, getConversationOptions, getPoliciesToReviewCount, getTasks } from "@/lib/tasks/queries";
import { getDashboardKpis } from "@/lib/dashboard/queries";
import { getUnansweredConversations } from "@/lib/insights/queries";
import { TasksModuleShell } from "./TasksModuleShell";
import type { TasksHomeStats } from "./TasksWorkspaceHome";

export const metadata: Metadata = {
  title: "Tareas — Growth Link",
};

export default async function TasksPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);

  const [tasks, members, contactOptions, conversationOptions, kpis, unanswered, policiesToReview] = await Promise.all([
    getTasks(workspaceId),
    getWorkspaceMembers(workspaceId),
    getContactOptions(workspaceId),
    getConversationOptions(workspaceId),
    getDashboardKpis(workspaceId),
    getUnansweredConversations(workspaceId),
    getPoliciesToReviewCount(workspaceId),
  ]);

  const ownMember = members.find((m) => m.memberId === ownMemberId);
  const greetingName = ownMember?.fullName.split(" ")[0] ?? "";

  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const criticalTasksToday = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      (t.priority === "urgent" || t.priority === "high") &&
      t.dueAt !== null &&
      new Date(t.dueAt) < todayEnd,
  ).length;

  const homeStats: TasksHomeStats = {
    greetingName,
    criticalTasksToday,
    meetingsToday: kpis.meetingsToday,
    pendingConversations: unanswered.length,
    policiesToReview,
  };

  return (
    <TasksModuleShell
      initialTasks={tasks}
      members={members}
      contactOptions={contactOptions}
      conversationOptions={conversationOptions}
      canAssignOthers={role === "owner" || role === "admin"}
      ownMemberId={ownMemberId}
      homeStats={homeStats}
    />
  );
}
