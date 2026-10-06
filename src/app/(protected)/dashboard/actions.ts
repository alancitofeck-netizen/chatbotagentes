"use server";

import { requireActiveWorkspace } from "@/lib/auth/session";
import { getActivitySeries, getLeadsBySource, getPendingTasks, type ChartRange } from "@/lib/dashboard/queries";
import { getDashboardHome, type DashboardPeriod } from "@/lib/dashboard/homeQueries";
import { completeTask as completeTaskShared } from "@/lib/tasks/actions";

export async function getActivitySeriesAction(range: ChartRange) {
  const { workspaceId } = await requireActiveWorkspace();
  return getActivitySeries(workspaceId, range);
}

export type SourcePeriod = "hoy" | "7d" | "30d" | "todo";

export async function getLeadsBySourceAction(period: SourcePeriod) {
  const { workspaceId } = await requireActiveWorkspace();
  if (period === "todo") return getLeadsBySource(workspaceId);
  const since = new Date();
  if (period === "hoy") since.setHours(0, 0, 0, 0);
  else since.setDate(since.getDate() - (period === "7d" ? 7 : 30));
  return getLeadsBySource(workspaceId, since);
}

export async function getPendingTasksAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPendingTasks(workspaceId);
}

/** Delegates to src/lib/tasks/actions.ts so the Dashboard card's quick
 * checkbox and the full CRM > Tareas view stay in sync (same status/
 * completed_at write, not duplicated logic). */
export async function completeTask(taskId: string) {
  return completeTaskShared(taskId);
}

export async function getDashboardHomeAction(period: DashboardPeriod) {
  const { workspaceId } = await requireActiveWorkspace();
  return getDashboardHome(workspaceId, period);
}
