"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppWindow, Link2, Plus, Search, LayoutGrid, List as ListIcon, Users2, Sparkles, Copy, Trophy, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getMiniAppsListAction } from "@/lib/miniApps/actions";
import { NewMiniAppWizard } from "./NewMiniAppWizard";
import { LinkAppWizard } from "./LinkAppWizard";
import { MiniAppCard } from "./MiniAppCard";
import { MiniAppListRow } from "./MiniAppListRow";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

/** Filtros del prototipo: un solo grupo de chips con conteo. */
type ChipFilter = "all" | "con" | "sin" | "active" | "inactive" | "sinAsesor";

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
  const [chip, setChip] = useState<ChipFilter>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refetch() {
    setMiniApps(await getMiniAppsListAction());
  }

  const metrics = useMemo(() => {
    const total = miniApps.length;
    const activas = miniApps.filter((a) => a.status === "active").length;
    const leadsTotales = miniApps.reduce((sum, a) => sum + a.leadsCount, 0);
    const convertidos = miniApps.reduce((sum, a) => sum + a.convertedLeadsCount, 0);
    const conversion = leadsTotales > 0 ? Math.round((convertidos / leadsTotales) * 100) : null;
    const usos = miniApps.reduce((sum, a) => sum + a.visitsCount, 0);
    const conLeads = miniApps.filter((a) => a.leadsCount > 0).length;
    const sinLeads = total - conLeads;
    const sinAsesor = miniApps.filter((a) => !a.assignedAgentName).length;
    const inactivas = total - activas;
    const top = [...miniApps].sort((a, b) => b.leadsCount - a.leadsCount)[0];
    return { total, activas, leadsTotales, convertidos, conversion, usos, conLeads, sinLeads, sinAsesor, inactivas, top: top && top.leadsCount > 0 ? top : null };
  }, [miniApps]);

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
      <div className="flex flex-wrap justify-end gap-2">
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
          {metrics.top && (
            <section className="navy-card flex flex-col gap-4 rounded-xl p-5" aria-label="La mini app que más leads trae">
              <p className="flex items-center gap-2 text-[13px] text-white/70">
                <Trophy className="size-4" aria-hidden="true" />
                La que más leads trae
              </p>
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <AppWindow className="size-6" aria-hidden="true" />
                </span>
                <h2 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em]">{metrics.top.name}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-white/5 p-3">
                  <p className="font-display text-2xl font-semibold tabular-nums">{metrics.top.leadsCount}</p>
                  <p className="text-xs text-white/60">leads</p>
                </div>
                <div className="rounded-md bg-white/5 p-3">
                  <p className="font-display text-2xl font-semibold tabular-nums">{metrics.top.convertedLeadsCount}</p>
                  <p className="text-xs text-white/60">a cliente</p>
                </div>
                <div className="rounded-md bg-white/5 p-3">
                  <p className="font-display text-2xl font-semibold tabular-nums">
                    {metrics.top.leadsCount > 0 ? Math.round((metrics.top.convertedLeadsCount / metrics.top.leadsCount) * 100) : 0}%
                  </p>
                  <p className="text-xs text-white/60">conversión</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(metrics.top!)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/20 text-sm font-medium text-white hover:bg-white/10"
                >
                  <Copy className="size-4" aria-hidden="true" />
                  {copiedId === metrics.top.id ? "Link copiado" : "Copiar link"}
                </button>
                <Link
                  href={`/mini-apps/${metrics.top.id}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/20 text-sm font-medium text-white hover:bg-white/10"
                >
                  Ver detalle
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile label="Mini Apps" value={metrics.total} hint={`${metrics.activas} activas`} />
            <KpiTile label="Leads" value={metrics.leadsTotales} hint={`${metrics.conLeads} con leads`} />
            <KpiTile label="Usos" value={metrics.usos} hint="visitas a las apps" />
            <KpiTile label="A cliente" value={metrics.convertidos} hint={metrics.conversion !== null ? `${metrics.conversion}% de los leads` : undefined} />
          </div>

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
