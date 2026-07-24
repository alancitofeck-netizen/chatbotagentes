"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { tabItemClassName } from "@/components/ui/Tabs";

const CRM_TABS = [
  { key: "board", label: "Tablero", href: "/crm?tab=board" },
  { key: "analytics", label: "Analytics", href: "/crm?tab=analytics" },
  { key: "agents", label: "Agentes", href: "/crm?tab=agents", managerOnly: true },
  { key: "agentes-ia", label: "Agentes IA", href: "/crm?tab=agentes-ia" },
  { key: "tasks", label: "Tareas", href: "/crm?tab=tasks" },
  { key: "kpis", label: "KPIs", href: "/crm?tab=kpis" },
] as const;

/**
 * Shared tab strip for CRM and ATS — ATS kept its own top-level route (/ats,
 * /ats/[vacancyId]) rather than nesting under /crm/ats (would have weakened
 * its independent workspace_modules activation), so this renders the same
 * row of tabs on both /crm and /ats to make the two feel like one area even
 * though they're separate routes. The 5 CRM-internal tabs stay ?tab=-driven
 * (CrmPageShell derives `view` from the URL on every render already, so a
 * real <Link> navigation to a new ?tab= value is a drop-in replacement for
 * the previous router.replace-driven TabsTrigger — same soft client nav,
 * just via an anchor instead of an onClick handler); ATS is a real cross-route
 * link, so it can't reuse the controlled Tabs/TabsTrigger primitive as-is.
 *
 * "Agentes" and ATS are admin-facing surfaces — an `agent`-role user must
 * never even see the tab, per the role-permissions spec's "el botón ni
 * siquiera debe renderizarse" (the matching backend 403 lives in
 * crm/page.tsx, ats/page.tsx and ats/[vacancyId]/page.tsx, since hiding the
 * button alone doesn't stop a typed-in URL).
 */
export function CrmAtsTabStrip({ atsEnabled, isAgent }: { atsEnabled: boolean; isAgent: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeKey = pathname.startsWith("/ats") ? "ats" : (searchParams.get("tab") ?? "board");
  const visibleTabs = CRM_TABS.filter((tab) => !("managerOnly" in tab && tab.managerOnly && isAgent));

  return (
    <div role="tablist" className="flex gap-5 border-b border-border-default">
      {visibleTabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={activeKey === tab.key}
          className={tabItemClassName(activeKey === tab.key, false)}
        >
          {tab.label}
        </Link>
      ))}
      {!isAgent && (
        <Link
          href={atsEnabled ? "/ats" : "#"}
          role="tab"
          aria-selected={activeKey === "ats"}
          aria-disabled={!atsEnabled}
          title={atsEnabled ? "ATS" : "ATS (Pronto)"}
          onClick={(e) => {
            if (!atsEnabled) e.preventDefault();
          }}
          className={tabItemClassName(activeKey === "ats", !atsEnabled)}
        >
          ATS
        </Link>
      )}
    </div>
  );
}
