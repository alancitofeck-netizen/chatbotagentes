import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getGoalsBoardAction } from "@/lib/goals/actions";
import { GoalsShell } from "./GoalsShell";

export const metadata: Metadata = {
  title: "Metas y Bonificaciones — Growth Link",
};

export default async function GoalsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "goals");

  const [board, members] = await Promise.all([getGoalsBoardAction(), getWorkspaceMembers(workspaceId)]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <GoalsShell initialBoard={board} members={members} />
    </div>
  );
}
