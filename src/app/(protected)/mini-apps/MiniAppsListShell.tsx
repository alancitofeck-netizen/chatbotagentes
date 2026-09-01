"use client";

import { useMemo, useState } from "react";
import { AppWindow, Link2, Plus, Search, LayoutGrid, List as ListIcon, Users, CheckCircle2, Users2, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getMiniAppsListAction } from "@/lib/miniApps/actions";
import { NewMiniAppWizard } from "./NewMiniAppWizard";
import { LinkAppWizard } from "./LinkAppWizard";
import { MiniAppCard } from "./MiniAppCard";
import { MiniAppListRow } from "./MiniAppListRow";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

type StatusFilter = "all" | "active" | "inactive";

export function MiniAppsListShell({
  initialMiniApps,
  members,
  moduleEnabled,
  canManage,
}: {
  initialMiniApps: MiniAppListItem[];
  members: WorkspaceMemberOption[];
  moduleEnabled: boolean;
  canManage: boolean;
}) {
  useAutoStartTour("mini-apps-intro");
  const [miniApps, setMiniApps] = useState(initialMiniApps);
  const [showCreate, setShowCreate] = useState(false);
  const [showLinkApp, setShowLinkApp] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  async function refetch() {
    setMiniApps(await getMiniAppsListAction());
  }

  const metrics = useMemo(() => {
    const total = miniApps.length;
    const activas = miniApps.filter((a) => a.status === "active").length;
    const leadsTotales = miniApps.reduce((sum, a) => sum + a.leadsCount, 0);
    const convertidos = miniApps.reduce((sum, a) => sum + a.convertedLeadsCount, 0);
    const conversion = leadsTotales > 0 ? Math.round((convertidos / leadsTotales) * 100) : null;
    return { total, activas, leadsTotales, conversion };
  }, [miniApps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return miniApps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [miniApps, search, statusFilter]);

  if (!moduleEnabled) {
    return (
      <EmptyState
        icon={AppWindow}
        title="El módulo Mini Apps no está activo"
        description="Activalo desde tu perfil, en Configuración > Módulos, para empezar a crear mini apps."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setShowLinkApp(true)}>
          <Link2 size={16} aria-hidden="true" />
          Vincular App
        </Button>
        <Button onClick={() => setShowCreate(true)} data-tour="mini-apps.new-button">
          <Plus size={16} aria-hidden="true" />
          Nueva Mini App
        </Button>
      </div>

      {miniApps.length === 0 ? (
        <EmptyState
          icon={AppWindow}
          title="Todavía no hay mini apps"
          description="Creá la primera para empezar a recibir leads de un simulador o formulario público."
          action={<Button onClick={() => setShowCreate(true)}>Nueva Mini App</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={AppWindow} label="Total Mini Apps" value={String(metrics.total)} />
            <MetricCard icon={CheckCircle2} label="Activas" value={String(metrics.activas)} />
            <MetricCard icon={Users} label="Leads totales" value={String(metrics.leadsTotales)} />
            {metrics.conversion !== null && <MetricCard icon={TrendingUp} label="Conversión promedio" value={`${metrics.conversion}%`} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs" data-tour="mini-apps.search">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar mini apps…"
                className="w-full rounded-full border border-border-default bg-surface-1 py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground outline-none focus:border-accent-500"
            >
              <option value="all">Filtrar por estado</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
            <div className="ml-auto flex gap-1 rounded-full bg-surface-2 p-1">
              <button
                type="button"
                aria-label="Vista de cuadrícula"
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
                className={`flex size-7 items-center justify-center rounded-full ${layout === "grid" ? "bg-surface-1 shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
              >
                <LayoutGrid size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Vista de lista"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
                className={`flex size-7 items-center justify-center rounded-full ${layout === "list" ? "bg-surface-1 shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
              >
                <ListIcon size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border-default bg-surface-2 p-10 text-center">
              <Users2 className="size-6 text-neutral-400" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Sin resultados</p>
              <p className="text-xs text-neutral-500">Probá con otro término de búsqueda o filtro.</p>
            </div>
          ) : layout === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((app) => (
                <MiniAppCard key={app.id} app={app} onDeleted={refetch} canManage={canManage} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((app) => (
                <MiniAppListRow key={app.id} app={app} onDeleted={refetch} canManage={canManage} />
              ))}
            </div>
          )}

          <div className="flex flex-col items-start gap-3 rounded-2xl border border-accent-500/20 bg-accent-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">¿Quieres crear una nueva Mini App?</p>
                <p className="text-[13px] text-neutral-500">Crea formularios y simuladores personalizados para capturar leads de forma inteligente.</p>
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} className="shrink-0">
              <Plus size={16} aria-hidden="true" />
              Crear Mini App
            </Button>
          </div>
        </>
      )}

      {showCreate && <NewMiniAppWizard members={members} onClose={() => setShowCreate(false)} onCreated={refetch} />}
      {showLinkApp && <LinkAppWizard members={members} onClose={() => setShowLinkApp(false)} onCreated={refetch} />}
    </div>
  );
}
