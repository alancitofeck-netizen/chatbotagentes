"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getActivitySeries, type ChartRange } from "@/lib/dashboard/queries";

export async function getActivitySeriesAction(range: ChartRange) {
  const { workspaceId } = await requireActiveWorkspace();
  return getActivitySeries(workspaceId, range);
}

export async function completeTask(taskId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("tasks")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/dashboard");
}
