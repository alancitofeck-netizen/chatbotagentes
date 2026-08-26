import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAiAgentList } from "@/lib/ai-agents/queries";
import { AiAgentsSection } from "./AiAgentsSection";

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

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Agentes IA</h1>
        <p className="text-sm text-neutral-500">Asistentes de IA especializados que responden conversaciones de WhatsApp.</p>
      </div>
      <AiAgentsSection initialAgents={aiAgents} />
    </div>
  );
}
