import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getGlobalTools } from "@/lib/ai-agents/queries";
import { getWorkspaceReferrals } from "@/lib/asesorias/referrals";
import { AgentWizardShell } from "./AgentWizardShell";

export const metadata: Metadata = {
  title: "Nuevo agente IA — Growth Link",
};

export default async function NewAiAgentPage() {
  const { workspaceId, name: workspaceName } = await requireActiveWorkspace();

  const [tools, referrals] = await Promise.all([getGlobalTools(), getWorkspaceReferrals(workspaceId)]);

  return <AgentWizardShell workspaceName={workspaceName} tools={tools} referralCount={referrals.length} />;
}
