import type { Metadata } from "next";
import { requireActiveWorkspace, getWorkspacePrimaryUserName } from "@/lib/auth/session";
import { getLeadsBySource } from "@/lib/dashboard/queries";
import { getCrmBoard } from "@/lib/crm/queries";
import { getAgentList } from "@/lib/agents/queries";
import { getCollectionsKpis } from "@/lib/collections/queries";
import { getUnansweredConversations, getReplyActivity } from "@/lib/insights/queries";
import { computeAdvisorStatus } from "@/lib/insights/advisorStatus";
import { getMiniAppsList } from "@/lib/miniApps/queries";
import { LeadsBySourcePanel } from "./LeadsBySourcePanel";
import { LeadDeck } from "./LeadDeck";
import { FunnelCard, MiniAppsRankingCard, TeamTodayCard } from "./HomeBlocks";
import { HomeGreeting, homeGreetingParts } from "./HomeGreeting";
import { RequiereAtencion } from "./RequiereAtencion";
import { DashboardLearningCard } from "@/components/onboarding/DashboardLearningCard";

export const metadata: Metadata = {
  title: "Dashboard — Growth Link",
};

/** Inicio como en la referencia del dueño: saludo, siguiente contacto, lo que
 * requiere atención, de dónde llegan, mini apps, embudo, equipo y progreso.
 * Todo con datos reales de la base. */
export default async function DashboardPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const isOwner = role === "owner";

  const [primaryUserName, leadsBySource, crmBoard, unansweredConversations, agentList, miniApps, replyActivity, collections] =
    await Promise.all([
      getWorkspacePrimaryUserName(workspaceId),
      getLeadsBySource(workspaceId),
      getCrmBoard(workspaceId),
      getUnansweredConversations(workspaceId),
      // Solo owners ven el equipo: se saltea la consulta para el resto.
      isOwner ? getAgentList(workspaceId) : Promise.resolve([]),
      getMiniAppsList(workspaceId),
      getReplyActivity(workspaceId),
      getCollectionsKpis(workspaceId),
    ]);

  const now = new Date();
  const firstName = primaryUserName.split(" ")[0];
  const greetingParts = homeGreetingParts(now);
  const advisors = agentList.map((agent) => ({ ...agent, ...computeAdvisorStatus(agent, now) }));
  const inactiveAgent = advisors.find((advisor) => advisor.advisorStatus === "sin_actividad");

  const closedWindowChats = unansweredConversations.filter((c) => c.hoursWaiting >= 24).length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <HomeGreeting
        name={firstName}
        greeting={greetingParts.greeting}
        dateLabel={greetingParts.dateLabel}
        pendingLeads={unansweredConversations.length}
        activity={replyActivity}
      />

      <LeadDeck conversations={unansweredConversations} />

      <RequiereAtencion
        overduePolicies={collections.overdueCount}
        closedWindowChats={closedWindowChats}
        inactiveAdvisor={inactiveAgent ? { name: inactiveAgent.fullName.split(" ")[0], sentence: inactiveAgent.sentence } : null}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-foreground">De dónde llegan</h2>
        <LeadsBySourcePanel initialSources={leadsBySource} />
      </section>

      <MiniAppsRankingCard apps={miniApps} />

      <FunnelCard board={crmBoard} />

      {isOwner && <TeamTodayCard advisors={advisors} />}

      <DashboardLearningCard />
    </div>
  );
}
