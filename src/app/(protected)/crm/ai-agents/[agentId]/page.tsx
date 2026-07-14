import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAiAgentDetail, getAgentPrompts, getGlobalTools, getAgentToolIds, getAgentKnowledgeBase, getAgentTestRuns, getAgentMetrics } from "@/lib/ai-agents/queries";
import { AiAgentDetailView } from "./AiAgentDetailView";

export const metadata: Metadata = {
  title: "Agente IA — Growth Link",
};

export default async function AiAgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const { workspaceId } = await requireActiveWorkspace();

  const agent = await getAiAgentDetail(workspaceId, agentId);
  if (!agent) notFound();

  const [prompts, tools, toolIds, knowledgeBase, testRuns, metrics] = await Promise.all([
    getAgentPrompts(agentId),
    getGlobalTools(),
    getAgentToolIds(agentId),
    getAgentKnowledgeBase(agentId),
    getAgentTestRuns(agentId),
    getAgentMetrics(workspaceId, agentId),
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
    />
  );
}
