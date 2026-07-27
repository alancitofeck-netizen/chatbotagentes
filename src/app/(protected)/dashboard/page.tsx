import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace, getWorkspacePrimaryUserName } from "@/lib/auth/session";
import {
  getDashboardKpis,
  getActivitySeries,
  getRecentConversations,
  getPendingTasks,
  getLeadsBySource,
  getTopOpportunities,
} from "@/lib/dashboard/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getContactOptions, getConversationOptions } from "@/lib/tasks/queries";
import { getUpcomingEvents } from "@/lib/calendar/queries";
import { getCrmBoard } from "@/lib/crm/queries";
import { getAgentList, getTeams } from "@/lib/agents/queries";
import { hasAnyKpiSetterSheet } from "@/lib/kpis/queries";
import { KpiCards } from "./KpiCards";
import { ActivityChart } from "./ActivityChart";
import { RecentConversations } from "./RecentConversations";
import { PendingTasks } from "./PendingTasks";
import { UpcomingMeetings } from "./UpcomingMeetings";
import { LeadsBySourceChart } from "./LeadsBySourceChart";
import { AiAssistantWidget } from "./AiAssistantWidget";
import { TopDeals } from "./TopDeals";
import { CrmAnalytics } from "../crm/CrmAnalytics";
import { KpisSection } from "./KpisSection";

export const metadata: Metadata = {
  title: "Dashboard — Growth Link",
};

export default async function DashboardPage() {
  const { workspaceId, role } = await requireActiveWorkspace();

  const [
    kpis,
    activity,
    conversations,
    tasks,
    leadsBySource,
    topDeals,
    ownMemberId,
    members,
    contactOptions,
    conversationOptions,
    upcomingEvents,
    primaryUserName,
    crmBoard,
    agents,
    teams,
    hasKpiSheet,
  ] = await Promise.all([
    getDashboardKpis(workspaceId),
    getActivitySeries(workspaceId, "7d"),
    getRecentConversations(workspaceId),
    getPendingTasks(workspaceId),
    getLeadsBySource(workspaceId),
    getTopOpportunities(workspaceId),
    getCurrentMemberId(workspaceId),
    getWorkspaceMembers(workspaceId),
    getContactOptions(workspaceId),
    getConversationOptions(workspaceId),
    getUpcomingEvents(workspaceId),
    // The workspace's own primary user — NOT the signed-in caller — so the
    // greeting reflects whose workspace this is. In Modo Supervisor those
    // differ: a platform admin viewing someone else's workspace must see
    // that workspace owner's name here, never their own.
    getWorkspacePrimaryUserName(workspaceId),
    // CRM/KPI data the Dashboard now surfaces directly (moved from the old
    // standalone CRM "KPIs" tab, see CrmAtsTabStrip.tsx) — reuses the exact
    // same queries/components CRM's own Analytics tab uses, nothing
    // duplicated. `crmBoard` is null for a workspace with no pipeline yet
    // (CRM module disabled, or an Agent's very first visit before
    // ensureCrmPipeline runs) — that's also this section's own visibility
    // gate, so no separate workspace_modules check is needed here.
    getCrmBoard(workspaceId),
    getAgentList(workspaceId),
    getTeams(workspaceId),
    hasAnyKpiSetterSheet(workspaceId),
  ]);
  const firstName = primaryUserName.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground text-balance">
          {firstName ? `Hola, ${firstName}` : "Hola de nuevo"}
        </h1>
        <p className="text-sm text-neutral-500">Esto es lo que está pasando en tu workspace hoy.</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-foreground">Resumen general</h2>
        <KpiCards kpis={kpis} activity={activity} />
      </section>

      {crmBoard && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[15px] font-semibold text-foreground">Rendimiento comercial</h2>
          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <CrmAnalytics board={crmBoard} agents={agents} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-foreground">KPIs por agente</h2>
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <KpisSection hasConnection={hasKpiSheet} teams={teams} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-foreground">Actividad y tendencias</h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            <ActivityChart initialData={activity} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RecentConversations conversations={conversations} />
              <PendingTasks
                tasks={tasks}
                members={members}
                contactOptions={contactOptions}
                conversationOptions={conversationOptions}
                canAssignOthers={role === "owner" || role === "admin"}
                ownMemberId={ownMemberId}
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <UpcomingMeetings events={upcomingEvents} />
            <LeadsBySourceChart sources={leadsBySource} />
            <AiAssistantWidget />
            <TopDeals deals={topDeals} />
          </div>
        </div>
      </section>
    </div>
  );
}
