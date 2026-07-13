"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { KanbanSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CrmBoard, OpportunityTag } from "@/lib/crm/queries";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { TaskItem, TaskOption } from "@/lib/tasks/queries";
import { CrmBoardShell } from "./CrmBoardShell";
import { CrmAnalytics } from "./CrmAnalytics";
import { AgentsList } from "./AgentsList";
import { TasksSection } from "./TasksSection";

type View = "board" | "analytics" | "agents" | "tasks";
const VALID_VIEWS: View[] = ["board", "analytics", "agents", "tasks"];

export function CrmPageShell({
  board,
  agents,
  teams,
  members,
  tags,
  initialTasks,
  contactOptions,
  conversationOptions,
  canAssignOthers,
  ownMemberId,
}: {
  board: CrmBoard | null;
  agents: AgentListItem[];
  teams: Team[];
  members: WorkspaceMemberOption[];
  tags: OpportunityTag[];
  initialTasks: TaskItem[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
            <TabsTrigger value="tasks">Tareas</TabsTrigger>
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
