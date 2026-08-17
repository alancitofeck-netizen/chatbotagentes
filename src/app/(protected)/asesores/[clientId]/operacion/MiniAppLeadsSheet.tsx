"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MiniAppLeadRow } from "@/lib/miniApps/queries";
import { getClientMiniAppLeadsAction } from "@/lib/clients/operacionActions";
import { LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT } from "../../../mini-apps/[miniAppId]/leadStatus";
import { MiniAppLeadDetailContent } from "./MiniAppLeadDetailContent";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

function leadEmail(lead: MiniAppLeadRow): string {
  const value = lead.data?.email;
  return typeof value === "string" && value ? value : "—";
}

export function MiniAppLeadsSheet({ clientId, miniAppId, miniAppName, onClose }: { clientId: string; miniAppId: string; miniAppName: string; onClose: () => void }) {
  const [leads, setLeads] = useState<MiniAppLeadRow[] | null>(null);
  const [viewLeadId, setViewLeadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClientMiniAppLeadsAction(clientId, miniAppId).then((rows) => {
      if (!cancelled) setLeads(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, miniAppId]);

  const viewLead = viewLeadId ? (leads ?? []).find((l) => l.id === viewLeadId) : null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        viewLead ? (
          <button type="button" onClick={() => setViewLeadId(null)} className="flex items-center gap-1.5 text-foreground hover:text-accent-600">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {viewLead.nombre}
          </button>
        ) : (
          miniAppName
        )
      }
      className="max-w-lg"
    >
      {viewLeadId ? (
        <MiniAppLeadDetailContent key={viewLeadId} clientId={clientId} leadId={viewLeadId} />
      ) : leads === null ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : leads.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={Users} title="Sin leads todavía" description="Esta Mini App todavía no capturó ningún lead." />
        </div>
      ) : (
        <div className="p-5">
          <p className="mb-3 text-xs text-neutral-500">Total de leads: {leads.length}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Teléfono</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-border-default">
                    <td className="py-2.5 text-neutral-500">{formatDate(lead.fecha)}</td>
                    <td className="py-2.5 font-medium text-foreground">{lead.nombre}</td>
                    <td className="py-2.5 text-neutral-500">{leadEmail(lead)}</td>
                    <td className="py-2.5 text-neutral-500">{lead.whatsapp}</td>
                    <td className="py-2.5">
                      <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => setViewLeadId(lead.id)} className="rounded-full border border-border-default px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-2">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Sheet>
  );
}
