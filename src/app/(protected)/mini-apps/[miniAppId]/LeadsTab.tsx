"use client";

import { useMemo, useState } from "react";
import { Download, Search, Users, UserCheck, UserPlus, Gauge } from "lucide-react";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { MiniAppLeadCard } from "./MiniAppLeadCard";

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

  const metrics = useMemo(() => {
    const total = leads.length;
    const nuevos = leads.filter((l) => l.status === "new").length;
    const convertidos = leads.filter((l) => l.status === "converted").length;
    const scores = leads.map((l) => l.data.score).filter((s): s is number => typeof s === "number");
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { total, nuevos, convertidos, avgScore };
  }, [leads]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-primary-950 p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Users} label="Total de leads" value={String(metrics.total)} />
        <MetricCard icon={UserPlus} label="Nuevos" value={String(metrics.nuevos)} />
        <MetricCard icon={UserCheck} label="Convertidos" value={String(metrics.convertidos)} />
        {metrics.avgScore !== null && <MetricCard icon={Gauge} label="Puntaje promedio" value={`${metrics.avgScore}/100`} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, WhatsApp o agente…"
            className="w-full rounded-full border border-white/10 bg-white/5 py-2 pr-3 pl-9 text-sm text-white placeholder:text-white/40 outline-none focus:border-accent-400"
          />
        </div>
        <a
          href={`/api/mini-apps/${miniApp.id}/leads/export?format=csv`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-white/10"
        >
          <Download size={14} aria-hidden="true" />
          Exportar CSV
        </a>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-10 text-center">
          <Users className="size-6 text-white/40" aria-hidden="true" />
          <p className="text-sm font-medium text-white">Sin leads todavía</p>
          <p className="text-xs text-white/50">Cuando lleguen leads de esta mini app, van a aparecer acá.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lead) => (
            <MiniAppLeadCard key={lead.id} lead={lead} onClick={() => setSelectedLeadId(lead.id)} />
          ))}
        </div>
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
