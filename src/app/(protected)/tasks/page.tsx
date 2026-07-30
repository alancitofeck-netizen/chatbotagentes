import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getTasks } from "@/lib/tasks/queries";
import { getGroupStatsBatch, getRecentGroups } from "@/lib/tasks/groups/queries";
import { TasksWorkspaceHome, type TasksHomeStats } from "./TasksWorkspaceHome";
import { getMonday } from "@/lib/calendar/week";

export const metadata: Metadata = {
  title: "Tareas — Growth Link",
};

export default async function TasksHomePage() {
  const { workspaceId } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);

  const [tasks, members, recentGroups] = await Promise.all([getTasks(workspaceId), getWorkspaceMembers(workspaceId), getRecentGroups(workspaceId)]);
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

  return (
    <TasksWorkspaceHome
      stats={stats}
      recentGroups={recentGroups.map((group) => ({
        group,
        stats: statsByGroup.get(group.id) ?? { pending: 0, inProgress: 0, completed: 0, total: 0, progressPct: 0 },
      }))}
    />
  );
}
