"use client";

import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import { MiniAppLeadsSheet } from "./MiniAppLeadsSheet";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function conversionPct(app: MiniAppListItem): number {
  if (app.leadsCount === 0) return 0;
  return Math.round((app.convertedLeadsCount / app.leadsCount) * 100);
}

export function MiniAppsSubTab({ clientId, miniApps, moduleEnabled }: { clientId: string; miniApps: MiniAppListItem[]; moduleEnabled: boolean }) {
  const [selected, setSelected] = useState<MiniAppListItem | null>(null);

  if (!moduleEnabled) {
    return <EmptyState icon={LayoutGrid} title="Módulo Mini Apps no habilitado" description="Este asesor no tiene el módulo Mini Apps activo en su workspace." />;
  }

  return (
    <Card>
      <CardHeader title="Mini Apps" action={<span className="text-xs text-neutral-500">{miniApps.length} en total</span>} />
      {miniApps.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="Sin Mini Apps todavía" description="Este asesor todavía no creó ninguna Mini App." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="pb-2 font-medium">Mini App</th>
                <th className="pb-2 font-medium">Leads</th>
                <th className="pb-2 font-medium">Último lead</th>
                <th className="pb-2 font-medium">Conversión</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {miniApps.map((app) => (
                <tr key={app.id} className="border-t border-border-default">
                  <td className="py-2.5 font-medium text-foreground">{app.name}</td>
                  <td className="py-2.5 text-neutral-500">{app.leadsCount}</td>
                  <td className="py-2.5 text-neutral-500">{formatDate(app.lastLeadAt)}</td>
                  <td className="py-2.5 text-neutral-500">{conversionPct(app)}%</td>
                  <td className="py-2.5">
                    <Badge variant={app.status === "active" ? "success" : "neutral"}>{app.status === "active" ? "Activa" : "Inactiva"}</Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    <button type="button" onClick={() => setSelected(app)} className="rounded-full border border-border-default px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-2">
                      Ver datos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <MiniAppLeadsSheet clientId={clientId} miniAppId={selected.id} miniAppName={selected.name} onClose={() => setSelected(null)} />}
    </Card>
  );
}
