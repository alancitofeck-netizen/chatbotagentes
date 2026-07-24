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
import type { AiAgentListItem } from "@/lib/ai-agents/queries";
import type { PlatformWorkspaceSummary } from "@/lib/platform/queries";
import { ensureCrmPipelineAction } from "@/lib/crm/actions";
import { CrmBoardShell } from "./CrmBoardShell";
import { CrmAnalytics } from "./CrmAnalytics";
import { AgentsList } from "./AgentsList";
import { PlatformWorkspacesTable } from "./PlatformWorkspacesTable";
import { TasksSection } from "./TasksSection";
import { AiAgentsSection } from "./AiAgentsSection";
import { CrmAtsTabStrip } from "./CrmAtsTabStrip";
import { KpisSection } from "./kpis/KpisSection";

type View = "board" | "analytics" | "agents" | "agentes-ia" | "tasks" | "kpis";
const VALID_VIEWS: View[] = ["board", "analytics", "agents", "agentes-ia", "tasks", "kpis"];

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
  aiAgents,
  atsEnabled,
  hasKpiConnection,
  isAgent,
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
  aiAgents: AiAgentListItem[];
  atsEnabled: boolean;
  hasKpiConnection: boolean;
  isAgent: boolean;
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
        <CrmAtsTabStrip atsEnabled={atsEnabled} isAgent={isAgent} />
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
            <AgentsList initialAgents={agents} initialTeams={teams} workspaceId={workspaceId} />
          )}
        </div>
      )}

      {view === "agentes-ia" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          <AiAgentsSection initialAgents={aiAgents} />
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

      {view === "kpis" && (
        <div className="flex-1 overflow-y-auto">
          <KpisSection hasConnection={hasKpiConnection} teams={teams} />
        </div>
      )}
    </div>
  );
}
