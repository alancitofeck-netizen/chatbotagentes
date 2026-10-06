import { PageHeader } from "@/components/ui/PageHeader";
import { BrainCircuit } from "lucide-react";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAiAgentList, getAiAgentListStats, type AgentListStats } from "@/lib/ai-agents/queries";
import { AiAgentsSection } from "./AiAgentsSection";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = {
  title: "Agentes IA — Growth Link",
};

/** Promovido fuera de /crm (era una pestaña, ?tab=agentes-ia) a su propio
 * módulo de nivel superior — un agente puede ser module_key='crm'/'ats'/
 * 'referrals', así que no era realmente una sub-sección del CRM. Mismo
 * criterio de acceso que tenía la pestaña: cualquier rol del workspace
 * puede verlo (a diferencia de "Agentes"/ATS, que sí están vedados a
 * role==='agent'). */
export default async function AgentesIaPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const aiAgents = await getAiAgentList(workspaceId);
  const statsMap = await getAiAgentListStats(
    workspaceId,
    aiAgents.map((a) => ({ id: a.id, advisorId: a.advisorId })),
  );
  const stats: Record<string, AgentListStats> = Object.fromEntries(statsMap);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <PageHeader icon={BrainCircuit} title="Agentes IA" description="Creá, configurá y supervisá agentes inteligentes que trabajan dentro de Growth Link." titleAdornment={<ModuleHelp description="Los Agentes IA son asistentes especializados: reciben información, la procesan, ejecutan una tarea y te devuelven un resultado." tourKey="ai-agents-intro" />} />
      </div>
      <AiAgentsSection initialAgents={aiAgents} stats={stats} />
    </div>
  );
}
