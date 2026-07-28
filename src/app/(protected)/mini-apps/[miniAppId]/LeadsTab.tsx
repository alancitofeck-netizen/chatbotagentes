"use client";

import { useMemo, useState } from "react";
import { Download, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { LeadDetailDrawer } from "./LeadDetailDrawer";

function statusVariant(status: MiniAppLeadRow["status"]) {
  if (status === "converted") return "success" as const;
  if (status === "discarded") return "error" as const;
  if (status === "contacted") return "info" as const;
  return "neutral" as const;
}

export function LeadsTab({
  miniApp,
  leads,
  members,
  onChanged,
}: {
  miniApp: MiniAppDetail;
  leads: MiniAppLeadRow[];
  members: WorkspaceMemberOption[];
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) => l.nombre.toLowerCase().includes(q) || l.whatsapp.includes(q) || (l.agente ?? "").toLowerCase().includes(q),
    );
  }, [leads, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          label="Buscar"
          containerClassName="w-64"
          placeholder="Nombre, WhatsApp o agente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <a
          href={`/api/mini-apps/${miniApp.id}/leads/export?format=csv`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2"
        >
          <Download size={14} aria-hidden="true" />
          Exportar CSV
        </a>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin leads todavía" description="Cuando lleguen leads de esta mini app, van a aparecer acá." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-default text-xs uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Agente</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="cursor-pointer border-b border-border-default last:border-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{lead.nombre}</td>
                  <td className="px-4 py-3 text-neutral-500">{lead.whatsapp}</td>
                  <td className="px-4 py-3 text-neutral-500">{lead.agente ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-500">{new Date(lead.fecha).toLocaleDateString("es")}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          members={members}
          onClose={() => setSelectedLeadId(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
