import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getContactOptions, getConversationOptions, getTasks } from "@/lib/tasks/queries";
import { getGroupStatsBatch, getRecentGroups, getTaskGroups } from "@/lib/tasks/groups/queries";
import { TasksWorkspaceHome, type TasksHomeStats } from "./TasksWorkspaceHome";
import { getMonday } from "@/lib/calendar/week";

export const metadata: Metadata = {
  title: "Tareas — Growth Link",
};

export default async function TasksHomePage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);

  const [tasks, members, recentGroups, allGroups, contactOptions, conversationOptions] = await Promise.all([
    getTasks(workspaceId),
    getWorkspaceMembers(workspaceId),
    // 6 = dos filas completas de la grilla de 3 en mobile.
    getRecentGroups(workspaceId, 6),
    getTaskGroups(workspaceId),
    getContactOptions(workspaceId),
    getConversationOptions(workspaceId),
  ]);
  const statsByGroup = await getGroupStatsBatch(
    workspaceId,
    recentGroups.map((g) => g.id),
  );

  const ownMember = members.find((m) => m.memberId === ownMemberId);
  const greetingName = ownMember?.fullName.split(" ")[0] ?? "";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekStart = getMonday(now);

  const pending = tasks.filter((t) => t.status !== "completed").length;
  const highPriority = tasks.filter((t) => t.status !== "completed" && (t.priority === "high" || t.priority === "urgent")).length;
  const dueToday = tasks.filter((t) => {
    if (t.status === "completed" || !t.dueAt) return false;
    const d = new Date(t.dueAt);
    return d >= todayStart && d < todayEnd;
  }).length;
  const completedThisWeek = tasks.filter((t) => t.status === "completed" && t.completedAt && new Date(t.completedAt) >= weekStart).length;

  const stats: TasksHomeStats = { greetingName, pending, highPriority, dueToday, completedThisWeek };

  const groupsById = new Map(allGroups.map((g) => [g.id, g]));

  return (
    <TasksWorkspaceHome
      stats={stats}
      tasks={tasks}
      groupsById={groupsById}
      ownMemberId={ownMemberId}
      members={members.map((m) => ({ memberId: m.memberId, fullName: m.fullName }))}
      contactOptions={contactOptions}
      conversationOptions={conversationOptions}
      canAssignOthers={role === "owner" || role === "admin"}
      recentGroups={recentGroups.map((group) => ({
        group,
        stats: statsByGroup.get(group.id) ?? { pending: 0, inProgress: 0, completed: 0, total: 0, progressPct: 0 },
      }))}
    />
  );
}
