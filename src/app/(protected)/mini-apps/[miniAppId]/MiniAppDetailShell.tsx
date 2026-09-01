"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { tabItemClassName } from "@/components/ui/Tabs";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { ContentCalendarData } from "@/lib/miniApps/contentCalendar";
import { getMiniAppLeadsAction } from "@/lib/miniApps/actions";
import { DashboardTab } from "./DashboardTab";
import { LeadsTab } from "./LeadsTab";
import { ConfiguracionTab } from "./ConfiguracionTab";
import { AnaliticasTab } from "./AnaliticasTab";
import { AccesoTab } from "./AccesoTab";
import { ContentCalendarTab } from "./ContentCalendarTab";

type View = "dashboard" | "leads" | "configuracion" | "analiticas" | "acceso" | "contenido";

export function MiniAppDetailShell({
  miniApp,
  initialLeads,
  members,
  visitsCount,
  canManage,
  contentCalendar,
  canEditContent,
}: {
  miniApp: MiniAppDetail;
  initialLeads: MiniAppLeadRow[];
  members: WorkspaceMemberOption[];
  visitsCount: number;
  canManage: boolean;
  contentCalendar: ContentCalendarData | null;
  canEditContent: boolean;
}) {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState(initialLeads);

  const isContentCalendar = miniApp.templateKey === "content_calendar";
  const TABS: { key: View; label: string }[] = [
    ...(isContentCalendar ? [{ key: "contenido" as const, label: "Contenido" }] : [{ key: "dashboard" as const, label: "Dashboard" }]),
    ...(isContentCalendar ? [] : [{ key: "leads" as const, label: "Leads" }]),
    { key: "configuracion", label: "Configuración" },
    ...(isContentCalendar ? [] : [{ key: "analiticas" as const, label: "Analíticas" }]),
    ...(canManage && miniApp.isPrivate ? [{ key: "acceso" as const, label: "Acceso" }] : []),
  ];
  const requestedTab = searchParams.get("tab");
  const defaultTab: View = isContentCalendar ? "contenido" : "dashboard";
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
        {view === "dashboard" && <DashboardTab leads={leads} visitsCount={visitsCount} templateKey={miniApp.templateKey} />}
        {view === "leads" && <LeadsTab miniApp={miniApp} leads={leads} members={members} onChanged={refetchLeads} />}
        {view === "configuracion" && <ConfiguracionTab miniApp={miniApp} members={members} canManage={canManage} />}
        {view === "analiticas" && <AnaliticasTab miniAppId={miniApp.id} />}
        {view === "acceso" && <AccesoTab miniAppId={miniApp.id} members={members} />}
        {view === "contenido" && contentCalendar && <ContentCalendarTab initialData={contentCalendar} canEdit={canEditContent} />}
      </div>
    </div>
  );
}
