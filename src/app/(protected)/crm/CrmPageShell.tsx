"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { toast } from "@/components/toast/toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import type { CrmBoard, CrmPipelineOption, OpportunityTag } from "@/lib/crm/queries";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import type { PlatformWorkspaceSummary } from "@/lib/platform/queries";
import type { ManychatLeadListItem } from "@/lib/integrations/manychat";
import { ensureCrmPipelineAction } from "@/lib/crm/actions";
import { CrmBoardShell } from "./CrmBoardShell";
import { CrmAnalytics } from "./CrmAnalytics";
import { AgentsList } from "./AgentsList";
import { PlatformWorkspacesTable } from "./PlatformWorkspacesTable";
import { TasksSection } from "./TasksSection";
import { LeadsSection } from "./LeadsSection";
import { CrmAtsTabStrip } from "./CrmAtsTabStrip";

type View = "board" | "analytics" | "agents" | "tasks" | "leads";
const VALID_VIEWS: View[] = ["board", "analytics", "agents", "tasks", "leads"];

export function CrmPageShell({
  workspaceId,
  board: initialBoard,
  pipelines,
  agents,
  teams,
  members,
  tags,
  initialTasks,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  ownMemberId,
  atsEnabled,
  manychatEnabled,
  manychatLeads,
  isAgent,
  isOwner,
  isPlatformAdmin,
  platformWorkspaces,
}: {
  workspaceId: string;
  board: CrmBoard | null;
  pipelines: CrmPipelineOption[];
  agents: AgentListItem[];
  teams: Team[];
  members: WorkspaceMemberOption[];
  tags: OpportunityTag[];
  initialTasks: TaskItem[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
  atsEnabled: boolean;
  manychatEnabled: boolean;
  manychatLeads: ManychatLeadListItem[];
  isAgent: boolean;
  /** Gates "Cambiar rol" in the Agentes tab (AgentsList) — only the Owner
   * can change roles, per updateMemberRole (src/lib/settings/actions.ts). */
  isOwner: boolean;
  isPlatformAdmin: boolean;
  platformWorkspaces: PlatformWorkspaceSummary[];
}) {
  const [board, setBoard] = useState(initialBoard);
  const [isCreatingPipeline, startCreatePipeline] = useTransition();
  const searchParams = useSearchParams();

  function handleCreatePipeline() {
    startCreatePipeline(async () => {
      try {
        const fresh = await ensureCrmPipelineAction();
        setBoard(fresh);
        toast.success("Pipeline de ventas creado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el pipeline de ventas.");
      }
    });
  }
  // Derived directly from the URL on every render (not mirrored into its own
  // state) — same fix applied to ProfileShell.tsx this session: Next.js
  // reuses this mounted component for same-route navigations (e.g. the
  // Dashboard's "Ver todas las tareas" link into /crm?tab=tasks), so a plain
  // useState seeded once would get stuck instead of reflecting the new URL.
  const requestedView = searchParams.get("tab");
  const view: View = VALID_VIEWS.includes(requestedView as View) ? (requestedView as View) : "board";

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 sm:px-6 lg:px-8">
        <CrmAtsTabStrip atsEnabled={atsEnabled} manychatEnabled={manychatEnabled} isAgent={isAgent} />
      </div>

      {view === "board" && (
        <CrmBoardShell
          initialBoard={board}
          initialPipelines={pipelines}
          members={members}
          agents={agents}
          tags={tags}
          onBoardChange={setBoard}
        />
      )}

      {view === "analytics" &&
        (board ? (
          <div className="flex-1 overflow-y-auto pb-4 sm:pb-6 lg:pb-8">
            <CrmAnalytics board={board} agents={agents} />
          </div>
        ) : (
          <div className="p-4 sm:p-6 lg:p-8">
            <EmptyState
              icon={KanbanSquare}
              title="Todavía no hay un pipeline de ventas"
              description="El analytics necesita al menos un pipeline de ventas."
              action={
                <Button onClick={handleCreatePipeline} loading={isCreatingPipeline}>
                  Crear pipeline de ventas
                </Button>
              }
            />
          </div>
        ))}

      {view === "agents" && !isAgent && (
        <div className="flex-1 overflow-y-auto pb-4 sm:pb-6 lg:pb-8">
          {isPlatformAdmin ? (
            <div className="px-4 sm:px-6 lg:px-8">
              <PlatformWorkspacesTable workspaces={platformWorkspaces} />
            </div>
          ) : (
            <AgentsList initialAgents={agents} initialTeams={teams} workspaceId={workspaceId} isOwner={isOwner} />
          )}
        </div>
      )}

      {view === "leads" && manychatEnabled && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          <LeadsSection leads={manychatLeads} />
        </div>
      )}

      {view === "tasks" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          <TasksSection
            initialTasks={initialTasks}
            members={members}
            contactOptions={contactOptions}
            conversationOptions={conversationOptions}
            canAssignOthers={canAssignOthers}
            ownMemberId={ownMemberId}
          />
        </div>
      )}
    </div>
  );
}
