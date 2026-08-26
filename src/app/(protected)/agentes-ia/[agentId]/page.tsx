import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import {
  getAiAgentDetail,
  getAgentPrompts,
  getGlobalTools,
  getAgentToolIds,
  getAgentKnowledgeBase,
  getAgentTestRuns,
  getAgentMetrics,
  getAgentAdvisorInfo,
  getAgentReferralActivityStats,
  getAgentFollowups,
} from "@/lib/ai-agents/queries";
import { getAgentReferralStats } from "@/lib/ai-agents/suggestions";
import { getWorkspaceReferrals } from "@/lib/asesorias/referrals";
import { AiAgentDetailView } from "./AiAgentDetailView";

export const metadata: Metadata = {
  title: "Agente IA — Growth Link",
};

export default async function AiAgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const { workspaceId } = await requireActiveWorkspace();

  const agent = await getAiAgentDetail(workspaceId, agentId);
  if (!agent) notFound();

  // El panel de estadísticas de referidos y las pestañas Referidos/Seguimientos
  // solo tienen sentido para un agente de referidos con un asesor puntual
  // asignado (mismo criterio ya establecido en Fase 11 — getAgentReferralStats).
  const isReferralsAgent = agent.moduleKey === "referrals" && Boolean(agent.advisorId);

  const [prompts, tools, toolIds, knowledgeBase, testRuns, metrics, advisorInfo, referralActivityStats, referralPipeline, referrals, followups] =
    await Promise.all([
      getAgentPrompts(agentId),
      getGlobalTools(),
      getAgentToolIds(agentId),
      getAgentKnowledgeBase(agentId),
      getAgentTestRuns(agentId),
      getAgentMetrics(workspaceId, agentId),
      isReferralsAgent ? getAgentAdvisorInfo(workspaceId, agent.advisorId) : Promise.resolve(null),
      isReferralsAgent ? getAgentReferralActivityStats(workspaceId, agent) : Promise.resolve(null),
      isReferralsAgent ? getAgentReferralStats(workspaceId, agent.advisorId) : Promise.resolve(null),
      isReferralsAgent ? getWorkspaceReferrals(workspaceId, agent.advisorId ?? undefined) : Promise.resolve([]),
      isReferralsAgent ? getAgentFollowups(workspaceId, agent.advisorId) : Promise.resolve([]),
    ]);

  return (
    <AiAgentDetailView
      agent={agent}
      initialPrompts={prompts}
      tools={tools}
      initialToolIds={toolIds}
      initialKnowledgeBase={knowledgeBase}
      initialTestRuns={testRuns}
      metrics={metrics}
      advisorInfo={advisorInfo}
      referralActivityStats={referralActivityStats}
      referralPipeline={referralPipeline}
      referrals={referrals}
      followups={followups}
    />
  );
}
