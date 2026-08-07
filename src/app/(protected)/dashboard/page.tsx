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
import { getAgentList } from "@/lib/agents/queries";
import {
  getUnansweredConversations,
  getWeekOverWeekMetrics,
  getOverdueTasksCount,
  getUncontactedLeads,
  hasLinkedInConnection,
} from "@/lib/insights/queries";
import { evaluateInsights } from "@/lib/insights/engine";
import { buildExecutiveSummary, buildTrendItems, buildRecommendedActions, deriveStaleOpportunities } from "@/lib/insights/summary";
import { computeAdvisorStatus } from "@/lib/insights/advisorStatus";
import type { EngineInput } from "@/lib/insights/types";
import { getDashboardHome } from "@/lib/dashboard/homeQueries";
import { DashboardHomeSection } from "./DashboardHomeSection";
import { KpiCards } from "./KpiCards";
import { ActivityChart } from "./ActivityChart";
import { RecentConversations } from "./RecentConversations";
import { PendingTasks } from "./PendingTasks";
import { UpcomingMeetings } from "./UpcomingMeetings";
import { LeadsBySourceChart } from "./LeadsBySourceChart";
import { TopDeals } from "./TopDeals";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { PriorityInsights } from "./PriorityInsights";
import { RecommendedActions } from "./RecommendedActions";
import { Trends } from "./Trends";
import { AdvisorPerformance } from "./AdvisorPerformance";

export const metadata: Metadata = {
  title: "Dashboard — Growth Link",
};

export default async function DashboardPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const isOwner = role === "owner";

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
    unansweredConversations,
    weekOverWeek,
    overdueTasksCount,
    uncontactedLeads,
    linkedinConnected,
    agentList,
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
    // Insights-first Dashboard redesign (2026-07-27) — see
    // src/lib/insights/ for the pure rules engine these feed.
    getCrmBoard(workspaceId),
    getUnansweredConversations(workspaceId),
    getWeekOverWeekMetrics(workspaceId),
    getOverdueTasksCount(workspaceId),
    getUncontactedLeads(workspaceId),
    hasLinkedInConnection(workspaceId),
    // Only Owners see Rendimiento de Asesores — skip this heavier query otherwise.
    isOwner ? getAgentList(workspaceId) : Promise.resolve([]),
  ]);
  const firstName = primaryUserName.split(" ")[0];
  // "Semana" es el tab default (mismo criterio que la referencia) — el resto
  // de los períodos se piden client-side al cambiar (DashboardHomeSection).
  const home = await getDashboardHome(workspaceId, firstName, "week");

  const staleOpportunities = deriveStaleOpportunities(crmBoard);
  const engineInput: EngineInput = {
    unansweredConversations,
    staleOpportunities,
    overdueTasksCount,
    weekOverWeek,
    hasLinkedInConnection: linkedinConnected,
  };
  const insights = evaluateInsights(engineInput);
  const { bullets, health } = buildExecutiveSummary(
    {
      wonThisWeek: weekOverWeek.wonThisWeek,
      unansweredCount: unansweredConversations.length,
      connectionsDeltaPct: weekOverWeek.connections.deltaPct,
      staleOpportunitiesCount: staleOpportunities.length,
      overdueTasksCount,
    },
    insights,
  );
  const trends = buildTrendItems(weekOverWeek);
  const recommendedActions = buildRecommendedActions({
    unansweredConversations,
    staleOpportunities,
    uncontactedLeads,
    overdueTasksCount,
  });
  const now = new Date();
  const advisors = agentList.map((agent) => ({ ...agent, ...computeAdvisorStatus(agent, now) }));

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <DashboardHomeSection firstName={firstName} initialData={home} initialPeriod="week" />

      <ExecutiveSummary bullets={bullets} health={health} />

      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-foreground">Insights prioritarios</h2>
        <PriorityInsights insights={insights} />
      </section>

      <RecommendedActions actions={recommendedActions} />

      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-foreground">Tendencias</h2>
        <Trends trends={trends} />
      </section>

      <AdvisorPerformance isOwner={isOwner} advisors={advisors} />

      <KpiCards kpis={kpis} activity={activity} compact />

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingMeetings events={upcomingEvents} />
        <TopDeals deals={topDeals} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivityChart initialData={activity} />
        <LeadsBySourceChart sources={leadsBySource} />
      </div>
    </div>
  );
}
