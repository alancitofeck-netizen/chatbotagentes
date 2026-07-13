"use client";

import { useState } from "react";
import { KanbanSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CrmBoard, OpportunityTag } from "@/lib/crm/queries";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { CrmBoardShell } from "./CrmBoardShell";
import { CrmAnalytics } from "./CrmAnalytics";
import { AgentsList } from "./AgentsList";

export function CrmPageShell({
  board,
  agents,
  teams,
  members,
  tags,
}: {
  board: CrmBoard | null;
  agents: AgentListItem[];
  teams: Team[];
  members: WorkspaceMemberOption[];
  tags: OpportunityTag[];
}) {
  const [view, setView] = useState<"board" | "analytics" | "agents">("board");

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 sm:px-6 lg:px-8">
        <Tabs value={view} onValueChange={(v) => setView(v as "board" | "analytics" | "agents")}>
          <TabsList>
            <TabsTrigger value="board">Tablero</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="agents">Agentes</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "board" && <CrmBoardShell initialBoard={board} members={members} agents={agents} tags={tags} />}

      {view === "analytics" &&
        (board ? (
          <div className="flex-1 overflow-y-auto pb-4 sm:pb-6 lg:pb-8">
            <CrmAnalytics board={board} />
          </div>
        ) : (
          <div className="p-4 sm:p-6 lg:p-8">
            <EmptyState
              icon={KanbanSquare}
              title="Todavía no hay un pipeline de ventas"
              description="El analytics necesita al menos un pipeline de ventas."
            />
          </div>
        ))}

      {view === "agents" && (
        <div className="flex-1 overflow-y-auto pb-4 sm:pb-6 lg:pb-8">
          <AgentsList initialAgents={agents} initialTeams={teams} />
        </div>
      )}
    </div>
  );
}
