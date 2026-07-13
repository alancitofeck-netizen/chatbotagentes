import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAdvisorsBoard } from "@/lib/advisors/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { AdvisorsBoardShell } from "./AdvisorsBoardShell";

export const metadata: Metadata = {
  title: "Asesores — Growth Link",
};

export default async function AdvisorsPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const [board, members] = await Promise.all([getAdvisorsBoard(workspaceId), getWorkspaceMembers(workspaceId)]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asesores</h1>
        <p className="text-sm text-neutral-500">Pólizas y clientes para agentes de seguros y asesores financieros.</p>
      </div>
      <AdvisorsBoardShell initialBoard={board} members={members} />
    </div>
  );
}
