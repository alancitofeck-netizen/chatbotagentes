import type { Metadata } from "next";
import { getCurrentMemberId, requireUser, requireActiveWorkspace } from "@/lib/auth/session";
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
import { KpiCards } from "./KpiCards";
import { ActivityChart } from "./ActivityChart";
import { RecentConversations } from "./RecentConversations";
import { PendingTasks } from "./PendingTasks";
import { UpcomingMeetings } from "./UpcomingMeetings";
import { LeadsBySourceChart } from "./LeadsBySourceChart";
import { AiAssistantWidget } from "./AiAssistantWidget";
import { TopDeals } from "./TopDeals";

export const metadata: Metadata = {
  title: "Dashboard — Growth Link",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const { workspaceId, role } = await requireActiveWorkspace();
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];

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
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground text-balance">
          {firstName ? `Hola, ${firstName}` : "Hola de nuevo"}
        </h1>
        <p className="text-sm text-neutral-500">Esto es lo que está pasando en tu workspace hoy.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <KpiCards kpis={kpis} activity={activity} />
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
    </div>
  );
}
