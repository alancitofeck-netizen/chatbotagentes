"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronRight, Bot, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { toast } from "@/components/toast/toast";
import type {
  AiAgentDetail,
  AiPromptVersion,
  AiToolOption,
  KnowledgeBaseEntry,
  AgentTestRun,
  AgentMetrics,
  AgentAdvisorInfo,
  AgentReferralActivityStats,
  AgentFollowupRow,
} from "@/lib/ai-agents/queries";
import type { ReferralStats } from "@/lib/ai-agents/suggestionAnalysis";
import type { ReferralRow } from "@/lib/asesorias/referrals";
import { toggleAiAgentStatus } from "@/lib/ai-agents/actions";
import { GeneralTab } from "./tabs/GeneralTab";
import { PromptTab } from "./tabs/PromptTab";
import { PersonalityTab } from "./tabs/PersonalityTab";
import { AdvisorProfileTab } from "./tabs/AdvisorProfileTab";
import { SuggestionsTab } from "./tabs/SuggestionsTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { KnowledgeBaseTab } from "./tabs/KnowledgeBaseTab";
import { ChannelsTab } from "./tabs/ChannelsTab";
import { TestTab } from "./tabs/TestTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { MetricsTab } from "./tabs/MetricsTab";
import { ReferralsTab } from "./tabs/ReferralsTab";
import { FollowupsTab } from "./tabs/FollowupsTab";
import { AgentStatsPanel } from "./AgentStatsPanel";

type Tab =
  | "general"
  | "prompt"
  | "personalidad"
  | "perfil-asesor"
  | "herramientas"
  | "conocimiento"
  | "canales"
  | "pruebas"
  | "historial"
  | "metricas"
  | "analisis-ia"
  | "referidos"
  | "seguimientos";
const VALID_TABS: Tab[] = [
  "general",
  "prompt",
  "personalidad",
  "perfil-asesor",
  "herramientas",
  "conocimiento",
  "canales",
  "pruebas",
  "historial",
  "metricas",
  "analisis-ia",
  "referidos",
  "seguimientos",
];

export function AiAgentDetailView({
  agent,
  initialPrompts,
  tools,
  initialToolIds,
  initialKnowledgeBase,
  initialTestRuns,
  metrics,
  advisorInfo,
  referralActivityStats,
  referralPipeline,
  referrals,
  followups,
}: {
  agent: AiAgentDetail;
  initialPrompts: AiPromptVersion[];
  tools: AiToolOption[];
  initialToolIds: string[];
  initialKnowledgeBase: KnowledgeBaseEntry[];
  initialTestRuns: AgentTestRun[];
  metrics: AgentMetrics;
  advisorInfo: AgentAdvisorInfo | null;
  referralActivityStats: AgentReferralActivityStats | null;
  referralPipeline: ReferralStats | null;
  referrals: ReferralRow[];
  followups: AgentFollowupRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isTogglingStatus, startToggleStatus] = useTransition();
  // Mismo patrón que CrmPageShell/ContactInfoPanel: derivado de la URL en
  // cada render, no espejado en useState (evita que quede "pegado" en
  // navegaciones a la misma ruta).
  const requested = searchParams.get("tab");
  const tab: Tab = VALID_TABS.includes(requested as Tab) ? (requested as Tab) : "general";

  function setTab(next: Tab) {
    router.replace(`/agentes-ia/${agent.id}?tab=${next}`, { scroll: false });
  }

  function handleToggleStatus() {
    const nextStatus = agent.status === "active" ? "inactive" : "active";
    startToggleStatus(async () => {
      try {
        await toggleAiAgentStatus(agent.id, nextStatus);
        toast.success(nextStatus === "active" ? "Agente reactivado." : "Agente pausado.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado del agente.");
      }
    });
  }

  const showReferralsSidebar = agent.moduleKey === "referrals" && Boolean(agent.advisorId);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <div className="flex items-center gap-1 text-sm text-neutral-500">
          <Link href="/agentes-ia" className="hover:text-foreground">
            Agentes IA
          </Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="text-foreground">{agent.name}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">{agent.name}</h1>
                <Badge variant={agent.status === "active" ? "success" : "neutral"}>{agent.status === "active" ? "Activo" : "Inactivo"}</Badge>
              </div>
              {agent.description && <p className="text-sm text-neutral-500">{agent.description}</p>}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleToggleStatus} loading={isTogglingStatus}>
            {agent.status === "active" ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {agent.status === "active" ? "Pausar agente" : "Reactivar agente"}
          </Button>
        </div>
      </div>

      <div className={showReferralsSidebar ? "grid grid-cols-1 gap-4 lg:grid-cols-3" : ""}>
        <div className={showReferralsSidebar ? "lg:col-span-2" : ""}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="personalidad">Personalidad</TabsTrigger>
              {agent.moduleKey === "referrals" && <TabsTrigger value="perfil-asesor">Perfil del asesor</TabsTrigger>}
              <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
              <TabsTrigger value="conocimiento">Base de conocimiento</TabsTrigger>
              <TabsTrigger value="canales">Canales</TabsTrigger>
              {showReferralsSidebar && <TabsTrigger value="referidos">Referidos</TabsTrigger>}
              {showReferralsSidebar && <TabsTrigger value="seguimientos">Seguimientos</TabsTrigger>}
              <TabsTrigger value="pruebas">Pruebas</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
              <TabsTrigger value="metricas">Métricas</TabsTrigger>
              <TabsTrigger value="analisis-ia">Análisis IA</TabsTrigger>
            </TabsList>

            <div className="pt-4">
              <TabsContent value="general">
                <GeneralTab agent={agent} />
              </TabsContent>
              <TabsContent value="prompt">
                <PromptTab agentId={agent.id} initialPrompts={initialPrompts} />
              </TabsContent>
              <TabsContent value="personalidad">
                <PersonalityTab agent={agent} />
              </TabsContent>
              {agent.moduleKey === "referrals" && (
                <TabsContent value="perfil-asesor">
                  <AdvisorProfileTab agentId={agent.id} />
                </TabsContent>
              )}
              <TabsContent value="herramientas">
                <ToolsTab agentId={agent.id} tools={tools} initialToolIds={initialToolIds} />
              </TabsContent>
              <TabsContent value="conocimiento">
                <KnowledgeBaseTab agentId={agent.id} initialEntries={initialKnowledgeBase} />
              </TabsContent>
              <TabsContent value="canales">
                <ChannelsTab agentId={agent.id} initialChannels={agent.channels} />
              </TabsContent>
              {showReferralsSidebar && (
                <TabsContent value="referidos">
                  <ReferralsTab referrals={referrals} />
                </TabsContent>
              )}
              {showReferralsSidebar && (
                <TabsContent value="seguimientos">
                  <FollowupsTab followups={followups} />
                </TabsContent>
              )}
              <TabsContent value="pruebas">
                <TestTab agentId={agent.id} />
              </TabsContent>
              <TabsContent value="historial">
                <HistoryTab initialRuns={initialTestRuns} />
              </TabsContent>
              <TabsContent value="metricas">
                <MetricsTab metrics={metrics} />
              </TabsContent>
              <TabsContent value="analisis-ia">
                <SuggestionsTab agentId={agent.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {showReferralsSidebar && (
          <div className="lg:col-span-1">
            <AgentStatsPanel advisorInfo={advisorInfo} activityStats={referralActivityStats} pipeline={referralPipeline} />
          </div>
        )}
      </div>
    </div>
  );
}
