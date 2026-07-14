"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import type {
  AiAgentDetail,
  AiPromptVersion,
  AiToolOption,
  KnowledgeBaseEntry,
  AgentTestRun,
  AgentMetrics,
} from "@/lib/ai-agents/queries";
import { GeneralTab } from "./tabs/GeneralTab";
import { PromptTab } from "./tabs/PromptTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { KnowledgeBaseTab } from "./tabs/KnowledgeBaseTab";
import { ChannelsTab } from "./tabs/ChannelsTab";
import { TestTab } from "./tabs/TestTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { MetricsTab } from "./tabs/MetricsTab";

type Tab = "general" | "prompt" | "herramientas" | "conocimiento" | "canales" | "pruebas" | "historial" | "metricas";
const VALID_TABS: Tab[] = ["general", "prompt", "herramientas", "conocimiento", "canales", "pruebas", "historial", "metricas"];

export function AiAgentDetailView({
  agent,
  initialPrompts,
  tools,
  initialToolIds,
  initialKnowledgeBase,
  initialTestRuns,
  metrics,
}: {
  agent: AiAgentDetail;
  initialPrompts: AiPromptVersion[];
  tools: AiToolOption[];
  initialToolIds: string[];
  initialKnowledgeBase: KnowledgeBaseEntry[];
  initialTestRuns: AgentTestRun[];
  metrics: AgentMetrics;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Mismo patrón que CrmPageShell/ContactInfoPanel: derivado de la URL en
  // cada render, no espejado en useState (evita que quede "pegado" en
  // navegaciones a la misma ruta).
  const requested = searchParams.get("tab");
  const tab: Tab = VALID_TABS.includes(requested as Tab) ? (requested as Tab) : "general";

  function setTab(next: Tab) {
    router.replace(`/crm/ai-agents/${agent.id}?tab=${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <Link href="/crm?tab=agentes-ia" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
          <ArrowLeft size={14} aria-hidden="true" />
          Agentes IA
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">{agent.name}</h1>
          <Badge variant={agent.status === "active" ? "success" : "neutral"}>{agent.status === "active" ? "Activo" : "Inactivo"}</Badge>
        </div>
        {agent.description && <p className="text-sm text-neutral-500">{agent.description}</p>}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
          <TabsTrigger value="conocimiento">Base de conocimiento</TabsTrigger>
          <TabsTrigger value="canales">Canales</TabsTrigger>
          <TabsTrigger value="pruebas">Pruebas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <div className="pt-4">
          <TabsContent value="general">
            <GeneralTab agent={agent} />
          </TabsContent>
          <TabsContent value="prompt">
            <PromptTab agentId={agent.id} initialPrompts={initialPrompts} />
          </TabsContent>
          <TabsContent value="herramientas">
            <ToolsTab agentId={agent.id} tools={tools} initialToolIds={initialToolIds} />
          </TabsContent>
          <TabsContent value="conocimiento">
            <KnowledgeBaseTab agentId={agent.id} initialEntries={initialKnowledgeBase} />
          </TabsContent>
          <TabsContent value="canales">
            <ChannelsTab agentId={agent.id} initialChannels={agent.channels} />
          </TabsContent>
          <TabsContent value="pruebas">
            <TestTab agentId={agent.id} />
          </TabsContent>
          <TabsContent value="historial">
            <HistoryTab initialRuns={initialTestRuns} />
          </TabsContent>
          <TabsContent value="metricas">
            <MetricsTab metrics={metrics} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
