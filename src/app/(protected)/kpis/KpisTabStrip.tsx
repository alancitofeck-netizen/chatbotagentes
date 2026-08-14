"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { tabItemClassName } from "@/components/ui/Tabs";

const TABS = [
  { key: "resumen", label: "Resumen", href: "/kpis" },
  { key: "agendas", label: "Agendas", href: "/kpis?tab=agendas" },
] as const;

/** KPIs = analítico, separado de Agenda (operativo, /crm/agenda) — mismo
 * criterio explícito del pedido del usuario de no mezclar ambas funciones
 * en una sola pantalla. "Resumen" es el KpisSection existente (setters
 * LinkedIn/Google Sheets), "Agendas" es la nueva vista sobre citas
 * setter→asesor. */
export function KpisTabStrip() {
  const searchParams = useSearchParams();
  const activeKey = searchParams.get("tab") ?? "resumen";

  return (
    <div role="tablist" className="flex gap-5 border-b border-border-default">
      {TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} role="tab" aria-selected={activeKey === tab.key} className={tabItemClassName(activeKey === tab.key, false)}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
