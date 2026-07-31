"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { tabItemClassName } from "@/components/ui/Tabs";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getMiniAppLeadsAction } from "@/lib/miniApps/actions";
import { DashboardTab } from "./DashboardTab";
import { LeadsTab } from "./LeadsTab";
import { ConfiguracionTab } from "./ConfiguracionTab";
import { AnaliticasTab } from "./AnaliticasTab";

type View = "dashboard" | "leads" | "configuracion" | "analiticas";
const TABS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "configuracion", label: "Configuración" },
  { key: "analiticas", label: "Analíticas" },
];

export function MiniAppDetailShell({
  miniApp,
  initialLeads,
  members,
  visitsCount,
  canManage,
}: {
  miniApp: MiniAppDetail;
  initialLeads: MiniAppLeadRow[];
  members: WorkspaceMemberOption[];
  visitsCount: number;
  canManage: boolean;
}) {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState(initialLeads);
  const requestedTab = searchParams.get("tab");
  const view: View = (TABS.some((t) => t.key === requestedTab) ? requestedTab : "dashboard") as View;

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
      </div>
    </div>
  );
}
