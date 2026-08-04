import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getPolicyBoardAction } from "@/lib/policies/actions";
import { PoliciesBoardShell } from "./PoliciesBoardShell";

export const metadata: Metadata = {
  title: "Pólizas — Growth Link",
};

export default async function PoliciesPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "policies");

  const [board, members] = await Promise.all([getPolicyBoardAction(), getWorkspaceMembers(workspaceId)]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Pólizas</h1>
        <p className="text-sm text-neutral-500">Toda tu cartera en un solo lugar</p>
      </div>
      <PoliciesBoardShell workspaceId={workspaceId} initialBoard={board} members={members} />
    </div>
  );
}
