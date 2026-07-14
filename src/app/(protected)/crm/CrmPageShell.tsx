"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import type { CrmBoard, CrmPipelineOption, OpportunityTag } from "@/lib/crm/queries";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import type { AiAgentListItem } from "@/lib/ai-agents/queries";
import { ensureCrmPipelineAction } from "@/lib/crm/actions";
import { CrmBoardShell } from "./CrmBoardShell";
import { CrmAnalytics } from "./CrmAnalytics";
import { AgentsList } from "./AgentsList";
import { TasksSection } from "./TasksSection";
import { AiAgentsSection } from "./AiAgentsSection";

type View = "board" | "analytics" | "agents" | "agentes-ia" | "tasks";
const VALID_VIEWS: View[] = ["board", "analytics", "agents", "agentes-ia", "tasks"];

export function CrmPageShell({
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
}: {
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
}) {
  const [board, setBoard] = useState(initialBoard);
  const [isCreatingPipeline, startCreatePipeline] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleCreatePipeline() {
    startCreatePipeline(async () => {
      const fresh = await ensureCrmPipelineAction();
      setBoard(fresh);
    });
  }
  // Derived directly from the URL on every render (not mirrored into its own
  // state) — same fix applied to ProfileShell.tsx this session: Next.js
  // reuses this mounted component for same-route navigations (e.g. the
  // Dashboard's "Ver todas las tareas" link into /crm?tab=tasks), so a plain
  // useState seeded once would get stuck instead of reflecting the new URL.
  const requestedView = searchParams.get("tab");
  const view: View = VALID_VIEWS.includes(requestedView as View) ? (requestedView as View) : "board";

  function setView(next: View) {
    router.replace(`/crm?tab=${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 sm:px-6 lg:px-8">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="board">Tablero</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="agents">Agentes</TabsTrigger>
            <TabsTrigger value="agentes-ia">Agentes IA</TabsTrigger>
            <TabsTrigger value="tasks">Tareas</TabsTrigger>
          </TabsList>
        </Tabs>
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

      {view === "agents" && (
        <div className="flex-1 overflow-y-auto pb-4 sm:pb-6 lg:pb-8">
          <AgentsList initialAgents={agents} initialTeams={teams} />
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
    </div>
  );
}
