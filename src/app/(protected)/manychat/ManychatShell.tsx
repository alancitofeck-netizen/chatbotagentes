"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import type { ManychatConnectionStatus, ManychatLeadListItem, ManychatDashboardSummary, ManychatContentStat } from "@/lib/integrations/manychat";
import { ResumenTab } from "./tabs/ResumenTab";
import { LeadsTab } from "./tabs/LeadsTab";
import { ConversacionesTab } from "./tabs/ConversacionesTab";
import { ContenidoTab } from "./tabs/ContenidoTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { ConfiguracionTab } from "./tabs/ConfiguracionTab";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

type Tab = "resumen" | "leads" | "conversaciones" | "contenido" | "analytics" | "configuracion";
const VALID_TABS: Tab[] = ["resumen", "leads", "conversaciones", "contenido", "analytics", "configuracion"];

/** Módulo independiente — GrowthLink RECIBE y ANALIZA la actividad de los
 * leads que ManyChat gestiona en Instagram, nunca controla su flujo ni
 * responde en su lugar. `status` vive acá (no en cada tab) porque
 * ConfiguracionTab lo actualiza al conectar/desconectar y el resto de las
 * pestañas necesitan reflejarlo sin esperar un reload — leads/dashboard/
 * contentStats siguen siendo server-fetched una sola vez (mismo criterio
 * que AiAgentsSection), se refrescan solos en la próxima carga real de la
 * página. */
export function ManychatShell({
  workspaceName,
  moduleEnabled,
  canManage,
  status: initialStatus,
  leads,
  dashboard,
  contentStats,
}: {
  workspaceName: string;
  moduleEnabled: boolean;
  canManage: boolean;
  status: ManychatConnectionStatus;
  leads: ManychatLeadListItem[];
  dashboard: ManychatDashboardSummary | null;
  contentStats: ManychatContentStat[];
}) {
  useAutoStartTour("manychat-intro");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(initialStatus);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const requested = searchParams.get("tab");
  const tab: Tab = VALID_TABS.includes(requested as Tab) ? (requested as Tab) : "resumen";
  const connected = status.connected || moduleEnabled;

  function setTab(next: Tab) {
    router.replace(`/manychat?tab=${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white">
          <Camera className="size-5" aria-hidden="true" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">ManyChat</h1>
            <ModuleHelp description="GrowthLink recibe y analiza la actividad de los leads que ManyChat gestiona en tu Instagram — nunca controla su flujo ni responde por vos." tourKey="manychat-intro" />
          </div>
          <p className="text-sm text-neutral-500">Instagram Automation & Analytics — {workspaceName}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList data-tour="manychat.tabs">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="conversaciones">Conversaciones</TabsTrigger>
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="configuracion" data-tour="manychat.tabs.configuracion">
            Configuración
          </TabsTrigger>
        </TabsList>

        <div className="pt-4">
          <TabsContent value="resumen">
            <ResumenTab connected={connected} dashboard={dashboard} onGoToConfig={() => setTab("configuracion")} />
          </TabsContent>
          <TabsContent value="leads">
            <LeadsTab connected={connected} leads={leads} onSelectLead={setSelectedContactId} onGoToConfig={() => setTab("configuracion")} />
          </TabsContent>
          <TabsContent value="conversaciones">
            <ConversacionesTab connected={connected} leads={leads} onSelectLead={setSelectedContactId} onGoToConfig={() => setTab("configuracion")} />
          </TabsContent>
          <TabsContent value="contenido">
            <ContenidoTab connected={connected} contentStats={contentStats} onGoToConfig={() => setTab("configuracion")} />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab connected={connected} dashboard={dashboard} onGoToConfig={() => setTab("configuracion")} />
          </TabsContent>
          <TabsContent value="configuracion">
            <ConfiguracionTab status={status} onStatusChange={setStatus} canManage={canManage} />
          </TabsContent>
        </div>
      </Tabs>

      {selectedContactId && <LeadDetailPanel key={selectedContactId} contactId={selectedContactId} onClose={() => setSelectedContactId(null)} />}
    </div>
  );
}
