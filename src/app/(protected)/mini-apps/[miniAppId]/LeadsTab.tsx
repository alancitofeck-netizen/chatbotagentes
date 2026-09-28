"use client";

import { useMemo, useState } from "react";
import { Download, Search, Users, UserPlus, Wallet, Plus, MessageCircle } from "lucide-react";
import type { MiniAppDetail, MiniAppLeadRow } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Avatar } from "@/components/ui/Avatar";
import { getLeadResultValue, getResultFieldSpec, formatResultValue } from "@/lib/miniApps/resultField";
import { formatRelativeTime } from "@/lib/utils/format";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { LeadQuickView } from "./LeadQuickView";
import { MiniAppLeadFormSheet } from "./MiniAppLeadFormSheet";

const PERIODS: { value: number; label: string }[] = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 0, label: "Todos" },
];

type SortKey = "recent" | "oldest" | "resultDesc" | "resultAsc";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Agrupa por Hoy / Ayer / Esta semana / Anteriores — mismo criterio simple
 * que el mockup pegado por el usuario (reemplaza al tablero kanban de la
 * Fase 2: cambiar la etapa de un lead ahora se hace desde el selector del
 * panel de la derecha, LeadQuickView, no arrastrando tarjetas). */
function groupByDate(leads: { lead: MiniAppLeadRow; value: number | null }[]) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; rows: { lead: MiniAppLeadRow; value: number | null }[] }[] = [
    { label: "Hoy", rows: [] },
    { label: "Ayer", rows: [] },
    { label: "Esta semana", rows: [] },
    { label: "Anteriores", rows: [] },
  ];
  for (const row of leads) {
    const d = new Date(row.lead.fecha);
    if (isSameDay(d, now)) groups[0].rows.push(row);
    else if (isSameDay(d, yesterday)) groups[1].rows.push(row);
    else if (d >= weekAgo) groups[2].rows.push(row);
    else groups[3].rows.push(row);
  }
  return groups.filter((g) => g.rows.length > 0);
}

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
  const [originFilter, setOriginFilter] = useState("");
  const [period, setPeriod] = useState(30);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showFullDrawer, setShowFullDrawer] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);

  const resultSpec = getResultFieldSpec(miniApp.templateKey);
  const origins = useMemo(() => [...new Set(leads.map((l) => l.origenApp))].sort(), [leads]);

  const periodStart = useMemo(() => {
    if (period === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - period);
    return d;
  }, [period]);

  const withinPeriod = useMemo(
    () => (periodStart ? leads.filter((l) => new Date(l.fecha) >= periodStart) : leads),
    [leads, periodStart],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withinPeriod
      .filter((l) => {
        if (originFilter && l.origenApp !== originFilter) return false;
        if (!q) return true;
        return l.nombre.toLowerCase().includes(q) || l.whatsapp.includes(q) || (l.agente ?? "").toLowerCase().includes(q);
      })
      .map((lead) => ({ lead, value: getLeadResultValue(miniApp.templateKey, lead.data) }))
      .sort((a, b) => {
        if (sort === "recent") return new Date(b.lead.fecha).getTime() - new Date(a.lead.fecha).getTime();
        if (sort === "oldest") return new Date(a.lead.fecha).getTime() - new Date(b.lead.fecha).getTime();
        if (sort === "resultDesc") return (b.value ?? -Infinity) - (a.value ?? -Infinity);
        return (a.value ?? Infinity) - (b.value ?? Infinity);
      });
  }, [withinPeriod, search, originFilter, sort, miniApp.templateKey]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const metrics = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const nuevosSemana = leads.filter((l) => new Date(l.fecha) >= weekAgo).length;
    const values = withinPeriod.map((l) => getLeadResultValue(miniApp.templateKey, l.data)).filter((v): v is number => v !== null);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const total = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
    return { totalLeads: withinPeriod.length, nuevosSemana, avg, total };
  }, [leads, withinPeriod, miniApp.templateKey]);

  // Derivado, no efecto: si el lead seleccionado desaparece de `leads` (se
  // borró, o un filtro/período lo saca), simplemente deja de "existir" acá
  // sin un setState extra en un efecto.
  const validSelectedLeadId = selectedLeadId && leads.some((l) => l.id === selectedLeadId) ? selectedLeadId : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Users} label={`Total de leads (${PERIODS.find((p) => p.value === period)?.label.toLowerCase()})`} value={String(metrics.totalLeads)} />
        <MetricCard icon={UserPlus} label="Nuevos esta semana" value={String(metrics.nuevosSemana)} />
        {resultSpec && metrics.avg !== null && (
          <MetricCard icon={Wallet} label={`${resultSpec.label} promedio`} value={formatResultValue(metrics.avg, resultSpec.format)} />
        )}
        {resultSpec && metrics.total !== null && resultSpec.format === "currency" && (
          <MetricCard icon={Wallet} label={`${resultSpec.label} total`} value={formatResultValue(metrics.total, resultSpec.format)} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, WhatsApp o email…"
            className="w-full rounded-full border border-border-default bg-surface-1 py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
          />
        </div>
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
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-[13px] font-medium text-foreground"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.value === 0 ? "Todos" : `Últimos ${p.label}`}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-[13px] font-medium text-foreground"
        >
          <option value="recent">Ordenar: Más recientes</option>
          <option value="oldest">Ordenar: Más antiguos</option>
          {resultSpec && <option value="resultDesc">Ordenar: {resultSpec.label} (mayor)</option>}
          {resultSpec && <option value="resultAsc">Ordenar: {resultSpec.label} (menor)</option>}
        </select>

        <div className="ml-auto flex items-center gap-2">
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
            {leads.length === 0 ? "Cuando lleguen leads de esta mini app, van a aparecer acá." : "Probá cambiar la búsqueda, el origen o el período."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-border-default">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col">
                <div className="border-b border-border-default bg-surface-2 px-4 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  {group.label} · {group.rows.length}
                </div>
                {group.rows.map(({ lead, value }) => {
                  const digits = lead.whatsapp.replace(/\D/g, "");
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`flex items-center gap-3 border-b border-border-default/60 px-4 py-3 text-left last:border-0 hover:bg-surface-2 ${
                        selectedLeadId === lead.id ? "bg-accent-500/10" : ""
                      }`}
                    >
                      <span className="relative shrink-0">
                        <Avatar name={lead.nombre} size={36} />
                        {lead.status === "new" && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-1 bg-accent-500" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{lead.nombre}</p>
                        <p className="truncate text-xs text-neutral-500">{lead.whatsapp}</p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-neutral-500 sm:inline">{lead.origenApp}</span>
                      {resultSpec && value !== null && (
                        <span className="shrink-0 text-sm font-semibold text-success-strong">{formatResultValue(value, resultSpec.format)}</span>
                      )}
                      <span className="hidden w-14 shrink-0 text-right text-xs text-neutral-400 sm:inline">{formatRelativeTime(lead.fecha)}</span>
                      {digits.length >= 8 && (
                        <a
                          href={`https://wa.me/${digits}`}
                          target="_blank"
                          rel="noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border-default text-neutral-500 hover:bg-surface-3"
                          title="Contactar por WhatsApp"
                        >
                          <MessageCircle className="size-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div>
            {validSelectedLeadId ? (
              <LeadQuickView
                key={validSelectedLeadId}
                miniApp={miniApp}
                leadId={validSelectedLeadId}
                onOpenFull={() => setShowFullDrawer(true)}
                onChanged={onChanged}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-neutral-400">
                Elegí un lead de la lista para ver el detalle.
              </div>
            )}
          </div>
        </div>
      )}

      {validSelectedLeadId && showFullDrawer && (
        <LeadDetailDrawer
          leadId={validSelectedLeadId}
          members={members}
          canManage={canManage}
          ownMemberId={ownMemberId}
          onClose={() => setShowFullDrawer(false)}
          onChanged={onChanged}
        />
      )}

      {showAddLead && <MiniAppLeadFormSheet miniAppId={miniApp.id} members={members} onClose={() => setShowAddLead(false)} onSaved={onChanged} />}
    </div>
  );
}
