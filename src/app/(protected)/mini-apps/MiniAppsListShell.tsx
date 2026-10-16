"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppWindow, Link2, Plus, Search, LayoutGrid, List as ListIcon, Users2, Sparkles, Copy, Trophy, AlertTriangle, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { cn } from "@/lib/utils/cn";
import type { MiniAppListItem, MiniAppsListResumen } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getMiniAppsListAction } from "@/lib/miniApps/actions";
import { NewMiniAppWizard } from "./NewMiniAppWizard";
import { LinkAppWizard } from "./LinkAppWizard";
import { MiniAppCard } from "./MiniAppCard";
import { MiniAppListRow } from "./MiniAppListRow";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

/** Filtros del prototipo: un solo grupo de chips con conteo. */
type ChipFilter = "all" | "con" | "sin" | "active" | "inactive" | "sinAsesor";

function pct1(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const value = Math.round((part / whole) * 1000) / 10;
  return `${value}`.replace(".", ",") + "%";
}

/** Variación contra el período anterior — "Histórico" cuando no hay ventana
 * anterior (workspace nuevo), nunca un delta inventado. */
function NavyDelta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (previous === 0 && current === 0) return <span className="text-[11px] text-white/40">Sin datos</span>;
  if (diff === 0) return <span className="text-[11px] text-white/40">Igual</span>;
  const up = diff > 0;
  return (
    <span className={cn("flex items-center gap-0.5 text-[11px] font-bold", up ? "text-emerald-400" : "text-rose-400")}>
      {up ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
      {up ? "+" : "-"}
      {Math.abs(diff)}
    </span>
  );
}

export function MiniAppsListShell({
  initialMiniApps,
  members,
  moduleEnabled,
  canManage,
  initialResumen,
}: {
  initialMiniApps: MiniAppListItem[];
  members: WorkspaceMemberOption[];
  moduleEnabled: boolean;
  canManage: boolean;
  initialResumen: MiniAppsListResumen | null;
}) {
  useAutoStartTour("mini-apps-intro");
  const [miniApps, setMiniApps] = useState(initialMiniApps);
  const [showCreate, setShowCreate] = useState(false);
  const [showLinkApp, setShowLinkApp] = useState(false);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipFilter>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refetch() {
    setMiniApps(await getMiniAppsListAction());
  }

  const metrics = useMemo(() => {
    const total = miniApps.length;
    const activas = miniApps.filter((a) => a.status === "active").length;
    const conLeads = miniApps.filter((a) => a.leadsCount > 0).length;
    const sinLeads = total - conLeads;
    const sinAsesor = miniApps.filter((a) => !a.assignedAgentName).length;
    const inactivas = total - activas;
    return { total, activas, conLeads, sinLeads, sinAsesor, inactivas };
  }, [miniApps]);

  const topApp = useMemo(() => (initialResumen?.top ? miniApps.find((a) => a.id === initialResumen.top!.id) : undefined), [initialResumen, miniApps]);

  const chips: { key: ChipFilter; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: metrics.total },
    { key: "con", label: "Con leads", count: metrics.conLeads },
    { key: "sin", label: "Sin leads", count: metrics.sinLeads },
    { key: "active", label: "Activas", count: metrics.activas },
    { key: "inactive", label: "Inactivas", count: metrics.inactivas },
    { key: "sinAsesor", label: "Sin asesor", count: metrics.sinAsesor },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return miniApps.filter((a) => {
      if (chip === "con" && a.leadsCount === 0) return false;
      if (chip === "sin" && a.leadsCount > 0) return false;
      if (chip === "active" && a.status !== "active") return false;
      if (chip === "inactive" && a.status !== "inactive") return false;
      if (chip === "sinAsesor" && a.assignedAgentName) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [miniApps, search, chip]);

  async function copyLink(app: MiniAppListItem) {
    const url = `${window.location.origin}/apps/${app.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(app.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Sin permiso de portapapeles: el link queda visible en la ficha de la app.
    }
  }

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
      <section className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
            <AppWindow className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-[20px] leading-tight font-semibold tracking-[-0.02em] text-foreground">Mini Apps</h1>
            <p className="text-[13px] text-neutral-500">Simuladores y formularios públicos que capturan leads para el CRM.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleHelp description="Creá simuladores y formularios públicos que capturan leads directo para tu CRM." tourKey="mini-apps-intro" />
          <Button variant="secondary" onClick={() => setShowLinkApp(true)}>
            <Link2 size={16} aria-hidden="true" />
            Vincular App
          </Button>
          <Button onClick={() => setShowCreate(true)} data-tour="mini-apps.new-button">
            <Plus size={16} aria-hidden="true" />
            Nueva Mini App
          </Button>
        </div>
      </section>

      {miniApps.length === 0 ? (
        <EmptyState
          icon={AppWindow}
          title="Todavía no hay mini apps"
          description="Creá la primera para empezar a recibir leads de un simulador o formulario público."
          action={<Button onClick={() => setShowCreate(true)}>Nueva Mini App</Button>}
        />
      ) : (
        <>
          {initialResumen && (
            <section className="navy-card grid grid-cols-1 gap-5 rounded-xl p-5 sm:grid-cols-2" aria-label="Rendimiento de los últimos 30 días">
              <div className="flex flex-col gap-4">
                <p className="text-[11px] font-bold tracking-wide text-white/60 uppercase">Rendimiento · últimos 30 días</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <b className="font-display text-[22px] leading-none font-extrabold tabular-nums text-white">{metrics.activas}</b>
                    <span className="text-[11.5px] text-white/50">Mini apps activas</span>
                    <span className="text-[11px] text-white/40">{metrics.sinLeads} sin leads</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="flex items-baseline gap-1.5">
                      <b className="font-display text-[22px] leading-none font-extrabold tabular-nums text-white">{initialResumen.visits.current}</b>
                      <NavyDelta current={initialResumen.visits.current} previous={initialResumen.visits.previous} />
                    </span>
                    <span className="text-[11.5px] text-white/50">Visitas</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <b className="font-display text-[22px] leading-none font-extrabold tabular-nums text-white">{initialResumen.leads.current}</b>
                    <span className="text-[11.5px] text-white/50">Leads</span>
                    <span className="text-[11px] text-white/40">{pct1(initialResumen.leads.current, initialResumen.visits.current)} de visitas</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <b className="font-display text-[22px] leading-none font-extrabold tabular-nums text-white">{initialResumen.clients.current}</b>
                    <span className="text-[11.5px] text-white/50">Clientes</span>
                    <span className="text-[11px] text-white/40">{pct1(initialResumen.clients.current, initialResumen.leads.current)} de leads</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent-400" style={{ width: `${metrics.total > 0 ? (metrics.activas / metrics.total) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                <p className="flex items-center gap-2 text-[13px] text-white/70">
                  <Trophy className="size-4" aria-hidden="true" />
                  La que más leads trae
                </p>
                {initialResumen.top ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <AppWindow className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-[17px] leading-tight font-semibold tracking-[-0.02em] text-white">{initialResumen.top.name}</h2>
                        <p className="text-[12px] text-white/50">
                          {initialResumen.top.visitsInPeriod} visitas · {initialResumen.top.conversionInPeriod}% conversión
                        </p>
                      </div>
                      <div className="ml-auto shrink-0 text-right">
                        <b className="font-display text-2xl font-semibold tabular-nums text-white">{initialResumen.top.leadsInPeriod}</b>
                        <p className="text-[11px] text-white/50">leads</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => topApp && copyLink(topApp)}
                        disabled={!topApp}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/20 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        <Copy className="size-4" aria-hidden="true" />
                        {copiedId === initialResumen.top.id ? "Link copiado" : "Copiar link"}
                      </button>
                      <Link
                        href={`/mini-apps/${initialResumen.top.id}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/20 text-sm font-medium text-white hover:bg-white/10"
                      >
                        Ver detalle
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-white/50">Todavía no hay leads en los últimos 30 días.</p>
                )}
              </div>
            </section>
          )}

          {metrics.sinLeads > 0 && (
            <button
              type="button"
              onClick={() => setChip("sin")}
              className="flex w-full items-center gap-3 rounded-lg bg-warning-bg p-3 text-left text-neutral-900"
            >
              <AlertTriangle className="size-5 shrink-0 text-warning-strong" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-900">
                  {metrics.sinLeads} {metrics.sinLeads === 1 ? "mini app todavía no trajo leads" : "mini apps todavía no trajeron leads"}
                </span>
                <span className="block text-xs text-neutral-700">Compartilas o pausalas para ordenar la lista</span>
              </span>
              <ChevronRight className="size-4 text-neutral-700" aria-hidden="true" />
            </button>
          )}

          <div className="flex flex-col gap-3">
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
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar mini apps">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={chip === c.key}
                  onClick={() => setChip(c.key)}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                    chip === c.key ? "border-navy bg-navy text-white" : "border-border-default bg-surface-1 text-neutral-600 hover:bg-surface-2"
                  }`}
                >
                  {c.label}
                  <span className="tabular-nums opacity-75">{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border-default bg-surface-2 p-10 text-center">
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

          <div className="flex flex-col items-start gap-3 rounded-lg border border-accent-500/20 bg-accent-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
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
