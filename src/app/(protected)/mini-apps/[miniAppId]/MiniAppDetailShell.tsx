"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { tabItemClassName } from "@/components/ui/Tabs";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { ContentCalendarData } from "@/lib/miniApps/contentCalendar";
import { getMiniAppLeadsAction } from "@/lib/miniApps/actions";
import { ResumenTab } from "./ResumenTab";
import { LeadsTab } from "./LeadsTab";
import { SimulacionesTab } from "./SimulacionesTab";
import { ConfiguracionTab } from "./ConfiguracionTab";
import { AnaliticasTab } from "./AnaliticasTab";
import { AccesoTab } from "./AccesoTab";
import { ContentCalendarTab } from "./ContentCalendarTab";

type View = "resumen" | "leads" | "simulaciones" | "configuracion" | "analiticas" | "acceso" | "contenido";

export function MiniAppDetailShell({
  miniApp,
  initialLeads,
  members,
  canManage,
  contentCalendar,
  canEditContent,
  ownMemberId,
}: {
  miniApp: MiniAppDetail;
  initialLeads: MiniAppLeadRow[];
  members: WorkspaceMemberOption[];
  canManage: boolean;
  contentCalendar: ContentCalendarData | null;
  canEditContent: boolean;
  ownMemberId: string | null;
}) {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState(initialLeads);

  const isContentCalendar = miniApp.templateKey === "content_calendar";
  const TABS: { key: View; label: string }[] = [
    ...(isContentCalendar ? [{ key: "contenido" as const, label: "Contenido" }] : [{ key: "resumen" as const, label: "Resumen" }]),
    ...(isContentCalendar ? [] : [{ key: "leads" as const, label: "Leads" }]),
    ...(isContentCalendar ? [] : [{ key: "simulaciones" as const, label: "Simulaciones" }]),
    ...(isContentCalendar ? [] : [{ key: "analiticas" as const, label: "Analíticas" }]),
    { key: "configuracion", label: "Configuración" },
    ...(canManage && miniApp.isPrivate ? [{ key: "acceso" as const, label: "Acceso" }] : []),
  ];
  const requestedTab = searchParams.get("tab");
  const defaultTab: View = isContentCalendar ? "contenido" : "resumen";
  const view: View = (TABS.some((t) => t.key === requestedTab) ? requestedTab : defaultTab) as View;

  async function refetchLeads() {
    setLeads(await getMiniAppLeadsAction(miniApp.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-5 border-b border-border-default px-4 sm:px-6 lg:px-8">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/mini-apps/${miniApp.id}?tab=${tab.key}`}
            role="tab"
            aria-selected={view === tab.key}
            className={tabItemClassName(view === tab.key, false)}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="px-4 sm:px-6 lg:px-8">
        {view === "resumen" && <ResumenTab miniApp={miniApp} />}
        {view === "leads" && (
          <LeadsTab miniApp={miniApp} leads={leads} members={members} canManage={canManage} ownMemberId={ownMemberId} onChanged={refetchLeads} />
        )}
        {view === "simulaciones" && (
          <SimulacionesTab miniApp={miniApp} leads={leads} members={members} canManage={canManage} ownMemberId={ownMemberId} onChanged={refetchLeads} />
        )}
        {view === "configuracion" && <ConfiguracionTab miniApp={miniApp} members={members} canManage={canManage} />}
        {view === "analiticas" && <AnaliticasTab miniAppId={miniApp.id} leads={leads} />}
        {view === "acceso" && <AccesoTab miniAppId={miniApp.id} members={members} />}
        {view === "contenido" && contentCalendar && <ContentCalendarTab initialData={contentCalendar} canEdit={canEditContent} />}
      </div>
    </div>
  );
}
