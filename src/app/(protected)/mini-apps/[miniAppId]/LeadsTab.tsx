"use client";

import { useMemo, useState } from "react";
import { Download, Search, Users, UserCheck, UserPlus, CalendarClock, Wallet, Plus, LayoutGrid, List } from "lucide-react";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { StatusBadge } from "@/components/responseSummary/StatusBadge";
import { getLeadResultValue, getResultFieldSpec, formatResultValue } from "@/lib/miniApps/resultField";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { MiniAppLeadsKanban } from "./MiniAppLeadsKanban";
import { MiniAppLeadFormSheet } from "./MiniAppLeadFormSheet";
import { LEAD_STATUS_LABEL } from "./leadStatus";

export function LeadsTab({
  miniApp,
  leads,
  members,
  canManage,
  ownMemberId,
  onChanged,
}: {
  miniApp: MiniAppDetail;
  leads: MiniAppLeadRow[];
  members: WorkspaceMemberOption[];
  canManage: boolean;
  ownMemberId: string | null;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [view, setView] = useState<"tablero" | "lista">("tablero");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);

  const origins = useMemo(() => [...new Set(leads.map((l) => l.origenApp))].sort(), [leads]);
  const agents = useMemo(() => [...new Set(leads.map((l) => l.agente).filter((a): a is string => Boolean(a)))].sort(), [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (originFilter && l.origenApp !== originFilter) return false;
      if (agentFilter && l.agente !== agentFilter) return false;
      if (!q) return true;
      return l.nombre.toLowerCase().includes(q) || l.whatsapp.includes(q) || (l.agente ?? "").toLowerCase().includes(q);
    });
  }, [leads, search, statusFilter, originFilter, agentFilter]);

  const resultSpec = getResultFieldSpec(miniApp.templateKey);

  const metrics = useMemo(() => {
    const total = leads.length;
    const sinContactar = leads.filter((l) => l.status === "new").length;
    const conCita = leads.filter((l) => l.status === "cita_agendada").length;
    const convertidos = leads.filter((l) => l.status === "converted").length;
    // Solo tiene sentido sumar cuando el resultado es un monto (currency) —
    // sumar puntajes (%) de distintos leads y mostrarlo como plata sería un
    // número inventado, así que directamente no se calcula para esos casos.
    const enPipeline =
      resultSpec?.format === "currency"
        ? leads.filter((l) => l.status !== "converted" && l.status !== "discarded").reduce((sum, l) => sum + (getLeadResultValue(miniApp.templateKey, l.data) ?? 0), 0)
        : null;
    return { total, sinContactar, conCita, convertidos, enPipeline };
  }, [leads, miniApp.templateKey, resultSpec?.format]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MetricCard icon={Users} label="Total de leads" value={String(metrics.total)} />
        <MetricCard icon={UserPlus} label="Sin contactar" value={String(metrics.sinContactar)} />
        <MetricCard icon={CalendarClock} label="Con cita" value={String(metrics.conCita)} />
        <MetricCard icon={UserCheck} label="Convertidos" value={String(metrics.convertidos)} />
        {metrics.enPipeline !== null && metrics.enPipeline > 0 && <MetricCard icon={Wallet} label="En pipeline" value={formatResultValue(metrics.enPipeline, "currency")} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, WhatsApp o agente…"
            className="w-full rounded-full border border-border-default bg-surface-1 py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-[13px] font-medium text-foreground"
        >
          <option value="">Etapa: Todas</option>
          {(Object.keys(LEAD_STATUS_LABEL) as (keyof typeof LEAD_STATUS_LABEL)[]).map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {origins.length > 1 && (
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-[13px] font-medium text-foreground"
          >
            <option value="">Origen: Todos</option>
            {origins.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
        {agents.length > 0 && (
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-[13px] font-medium text-foreground"
          >
            <option value="">Agente: Todos</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border-default bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setView("tablero")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${view === "tablero" ? "bg-accent-500 text-white" : "text-neutral-600"}`}
            >
              <LayoutGrid size={14} aria-hidden="true" />
              Tablero
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${view === "lista" ? "bg-accent-500 text-white" : "text-neutral-600"}`}
            >
              <List size={14} aria-hidden="true" />
              Lista
            </button>
          </div>
          <DropdownMenu
            trigger={
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2">
                <Download size={14} aria-hidden="true" />
                Exportar
              </span>
            }
            items={[
              { label: "CSV", onSelect: () => window.open(`/api/mini-apps/${miniApp.id}/leads/export?format=csv`, "_blank") },
              { label: "Excel", onSelect: () => window.open(`/api/mini-apps/${miniApp.id}/leads/export?format=xlsx`, "_blank") },
              { label: "PDF", onSelect: () => window.open(`/api/mini-apps/${miniApp.id}/leads/export?format=pdf`, "_blank") },
            ]}
          />
          <button
            type="button"
            onClick={() => setShowAddLead(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent-500 to-primary-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:brightness-110"
          >
            <Plus size={14} aria-hidden="true" />
            Agregar lead
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border-default bg-surface-2 p-10 text-center">
          <Users className="size-6 text-neutral-400" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{leads.length === 0 ? "Sin leads todavía" : "Ningún lead coincide con el filtro"}</p>
          <p className="text-xs text-neutral-500">
            {leads.length === 0 ? "Cuando lleguen leads de esta mini app, van a aparecer acá." : "Probá cambiar la búsqueda o los filtros."}
          </p>
        </div>
      ) : view === "tablero" ? (
        <MiniAppLeadsKanban leads={filtered} templateKey={miniApp.templateKey} onOpen={setSelectedLeadId} onChanged={onChanged} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-2 text-left text-xs font-medium tracking-wide text-neutral-400 uppercase">
                <th className="p-3">Lead</th>
                <th className="p-3">Origen</th>
                <th className="p-3">Agente</th>
                <th className="p-3">Etapa</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="cursor-pointer border-b border-border-default/60 last:border-0 hover:bg-surface-2"
                >
                  <td className="p-3">
                    <p className="font-medium text-foreground">{lead.nombre}</p>
                    <p className="text-xs text-neutral-500">{lead.whatsapp}</p>
                  </td>
                  <td className="p-3 text-neutral-500">{lead.origenApp}</td>
                  <td className="p-3 text-neutral-500">{lead.agente ?? "—"}</td>
                  <td className="p-3">
                    <StatusBadge>{LEAD_STATUS_LABEL[lead.status]}</StatusBadge>
                  </td>
                  <td className="p-3 text-neutral-500">{new Date(lead.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailDrawer
          leadId={selectedLeadId}
          members={members}
          canManage={canManage}
          ownMemberId={ownMemberId}
          onClose={() => setSelectedLeadId(null)}
          onChanged={onChanged}
        />
      )}

      {showAddLead && <MiniAppLeadFormSheet miniAppId={miniApp.id} members={members} onClose={() => setShowAddLead(false)} onSaved={onChanged} />}
    </div>
  );
}
