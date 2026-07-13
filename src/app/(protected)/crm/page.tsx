import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getCrmBoard } from "@/lib/crm/queries";
import { getAgentList, getTeams } from "@/lib/agents/queries";
import { getWorkspaceMembers, getWorkspaceTags } from "@/lib/inbox/queries";
import { getContactOptions, getConversationOptions, getTasks } from "@/lib/tasks/queries";
import { CrmPageShell } from "./CrmPageShell";

export const metadata: Metadata = {
  title: "CRM — Growth Link",
};

export default async function CrmPage() {
  const { workspaceId, role } = await requireActiveWorkspace();

  const [board, agents, teams, members, tags, tasks, contactOptions, conversationOptions, ownMemberId] = await Promise.all([
    getCrmBoard(workspaceId),
    getAgentList(workspaceId),
    getTeams(workspaceId),
    getWorkspaceMembers(workspaceId),
    getWorkspaceTags(workspaceId),
    getTasks(workspaceId),
    getContactOptions(workspaceId),
    getConversationOptions(workspaceId),
    getCurrentMemberId(workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">CRM</h1>
        <p className="text-sm text-neutral-500">Arrastra las tarjetas para mover una oportunidad de etapa.</p>
      </div>
      <CrmPageShell
        board={board}
        agents={agents}
        teams={teams}
        members={members}
        tags={tags}
        initialTasks={tasks}
        contactOptions={contactOptions}
        conversationOptions={conversationOptions}
        canAssignOthers={role === "owner" || role === "admin"}
        ownMemberId={ownMemberId}
      />
    </div>
  );
}
