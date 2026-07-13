"use server";

import { requireActiveWorkspace } from "@/lib/auth/session";
import { getActivitySeries, getPendingTasks, type ChartRange } from "@/lib/dashboard/queries";
import { completeTask as completeTaskShared } from "@/lib/tasks/actions";

export async function getActivitySeriesAction(range: ChartRange) {
  const { workspaceId } = await requireActiveWorkspace();
  return getActivitySeries(workspaceId, range);
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
