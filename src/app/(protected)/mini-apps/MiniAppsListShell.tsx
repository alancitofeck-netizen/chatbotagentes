"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppWindow,
  Link2,
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Users2,
  Sparkles,
  Copy,
  Trophy,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
  MoreHorizontal,
  Share2,
  UserRound,
  Eye,
  Pencil,
  Pause,
  Play,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import type { MiniAppListItem, MiniAppsListResumen } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getMiniAppsListAction, setMiniAppStatusAction, assignMiniAppAgentAction } from "@/lib/miniApps/actions";
import { TEMPLATE_KEY_META } from "@/lib/miniApps/templateCatalog";
import { NewMiniAppWizard } from "./NewMiniAppWizard";
import { LinkAppWizard } from "./LinkAppWizard";
import { MiniAppCard } from "./MiniAppCard";
import { MiniAppListRow } from "./MiniAppListRow";
import { miniAppVisual } from "./miniAppVisuals";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

type SortKey = "leads" | "visits" | "conversion" | "newest";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "leads", label: "Más leads" },
  { key: "visits", label: "Más visitas" },
  { key: "conversion", label: "Mejor conversión" },
  { key: "newest", label: "Más nuevas" },
];
const MOBILE_PAGE_SIZE = 7;

function appConversion(app: MiniAppListItem): number {
  return app.visitsCount > 0 ? app.leadsCount / app.visitsCount : 0;
}

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
  const [sortBy, setSortBy] = useState<SortKey>("leads");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [actionSheetAppId, setActionSheetAppId] = useState<string | null>(null);
  const [sheetView, setSheetView] = useState<"menu" | "assign">("menu");
  const [isUpdatingApp, startUpdatingApp] = useTransition();
  const router = useRouter();

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

  // Orden del selector "⇅" (mobile) — no toca `filtered`, que sigue
  // alimentando la vista de escritorio en su orden natural.
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "leads":
        return arr.sort((a, b) => b.leadsCount - a.leadsCount);
      case "visits":
        return arr.sort((a, b) => b.visitsCount - a.visitsCount);
      case "conversion":
        return arr.sort((a, b) => appConversion(b) - appConversion(a));
      case "newest":
        return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [filtered, sortBy]);

  // Top 5 por leads de TODO el workspace (no del filtro activo) — el
  // numerito de ranking no debería cambiar solo porque alguien busca o
  // filtra la lista.
  const rankByLeads = useMemo(() => {
    const map = new Map<string, number>();
    [...miniApps]
      .filter((a) => a.leadsCount > 0)
      .sort((a, b) => b.leadsCount - a.leadsCount)
      .slice(0, 5)
      .forEach((a, i) => map.set(a.id, i + 1));
    return map;
  }, [miniApps]);

  const actionSheetApp = actionSheetAppId ? miniApps.find((a) => a.id === actionSheetAppId) : undefined;

  function closeActionSheet() {
    setActionSheetAppId(null);
    setSheetView("menu");
  }

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

  function shareOnWhatsApp(app: MiniAppListItem) {
    const url = `${window.location.origin}/apps/${app.slug}`;
    const text = `Te comparto "${app.name}": ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function toggleStatus(app: MiniAppListItem) {
    const nextStatus = app.status === "active" ? "inactive" : "active";
    startUpdatingApp(async () => {
      try {
        await setMiniAppStatusAction(app.id, nextStatus);
        setMiniApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: nextStatus } : a)));
        toast.success(nextStatus === "active" ? "Mini app reactivada." : "Mini app pausada.");
        closeActionSheet();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
      }
    });
  }

  function assignAgent(app: MiniAppListItem, memberId: string | null) {
    startUpdatingApp(async () => {
      try {
        await assignMiniAppAgentAction(app.id, memberId);
        const agentName = memberId ? (members.find((m) => m.memberId === memberId)?.fullName ?? null) : null;
        setMiniApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, assignedAgentName: agentName } : a)));
        toast.success("Asesor actualizado.");
        setSheetView("menu");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo asignar el asesor.");
      }
    });
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
      {/* ===== Encabezado — solo mobile ===== */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="font-display text-[21px] font-semibold tracking-[-0.02em] text-foreground">Mini Apps</h1>
          <ModuleHelp description="Simuladores y formularios públicos que capturan leads para el CRM." tourKey="mini-apps-intro" compact />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLinkApp(true)}
            aria-label="Vincular App"
            title="Vincular App"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-1 text-foreground"
          >
            <Link2 size={17} aria-hidden="true" />
          </button>
          <Button onClick={() => setShowCreate(true)} data-tour="mini-apps.new-button">
            <Plus size={16} aria-hidden="true" />
            Nueva
          </Button>
        </div>
      </div>

      {/* ===== Encabezado — solo desktop ===== */}
      <section className="hidden rounded-xl border border-border-default bg-surface-1 p-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
          {/* ===== Resumen — solo mobile ===== */}
          {initialResumen && (
            <section className="navy-card flex flex-col gap-3 rounded-2xl p-4 sm:hidden" aria-label="Rendimiento de los últimos 30 días">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wide text-white/60 uppercase">Últimos 30 días</span>
                <span className="flex items-center gap-1 text-[12.5px] font-semibold text-white/70">
                  30d
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </span>
              </div>

              <div className="flex items-stretch divide-x divide-white/10">
                <div className="flex flex-1 flex-col items-center gap-0.5 px-1 text-center">
                  <b className="font-display text-[19px] leading-none font-extrabold tabular-nums text-white">{metrics.total}</b>
                  <span className="text-[10.5px] text-white/50">Apps</span>
                  <span className="text-[10px] font-medium text-amber-400">{metrics.sinLeads} sin leads</span>
                </div>
                <div className="flex flex-1 flex-col items-center gap-0.5 px-1 text-center">
                  <b className="font-display text-[19px] leading-none font-extrabold tabular-nums text-white">{initialResumen.visits.current}</b>
                  <span className="text-[10.5px] text-white/50">Visitas</span>
                  <NavyDelta current={initialResumen.visits.current} previous={initialResumen.visits.previous} />
                </div>
                <div className="flex flex-1 flex-col items-center gap-0.5 px-1 text-center">
                  <b className="font-display text-[19px] leading-none font-extrabold tabular-nums text-white">{initialResumen.leads.current}</b>
                  <span className="text-[10.5px] text-white/50">Leads</span>
                  <NavyDelta current={initialResumen.leads.current} previous={initialResumen.leads.previous} />
                </div>
                <div className="flex flex-1 flex-col items-center gap-0.5 px-1 text-center">
                  <b className="font-display text-[19px] leading-none font-extrabold tabular-nums text-white">{initialResumen.clients.current}</b>
                  <span className="text-[10.5px] text-white/50">Clientes</span>
                  <NavyDelta current={initialResumen.clients.current} previous={initialResumen.clients.previous} />
                </div>
              </div>

              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent-400"
                    style={{ width: `${Math.min(100, initialResumen.visits.current > 0 ? (initialResumen.leads.current / initialResumen.visits.current) * 100 : 0)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="text-white/50">Visitas → leads</span>
                  <span className="font-semibold text-emerald-300">{pct1(initialResumen.leads.current, initialResumen.visits.current)} de conversión</span>
                </div>
              </div>

              {initialResumen.top && (
                <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
                  <Trophy className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
                  <Link href={`/mini-apps/${initialResumen.top.id}`} className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-bold tracking-wide text-white/50 uppercase">La que más leads trae</p>
                    <p className="truncate text-[13.5px] font-semibold text-white">{initialResumen.top.name}</p>
                    <p className="text-[11px] text-white/50">
                      {initialResumen.top.visitsInPeriod} visitas · {initialResumen.top.conversionInPeriod}%
                    </p>
                  </Link>
                  <b className="shrink-0 font-display text-[19px] font-bold text-white">{initialResumen.top.leadsInPeriod}</b>
                  <button
                    type="button"
                    onClick={() => topApp && copyLink(topApp)}
                    disabled={!topApp}
                    aria-label="Copiar link"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-navy disabled:opacity-50"
                  >
                    {copiedId === initialResumen.top.id ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ===== Resumen — solo desktop ===== */}
          {initialResumen && (
            <section className="navy-card hidden grid-cols-1 gap-5 rounded-xl p-5 sm:grid sm:grid-cols-2" aria-label="Rendimiento de los últimos 30 días">
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
              className="hidden w-full items-center gap-3 rounded-lg bg-warning-bg p-3 text-left text-neutral-900 sm:flex"
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

          {/* ===== Buscador + orden + chips — solo mobile ===== */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setMobileVisibleCount(MOBILE_PAGE_SIZE);
                  }}
                  placeholder="Buscar mini apps…"
                  className="w-full rounded-full border border-border-default bg-surface-1 py-2.5 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
                />
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSortMenu((v) => !v)}
                  aria-expanded={showSortMenu}
                  className="flex h-10 items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3 text-[13px] font-semibold whitespace-nowrap text-foreground"
                >
                  <ArrowUpDown size={14} aria-hidden="true" />
                  {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
                </button>
                {showSortMenu && (
                  <>
                    <button type="button" aria-label="Cerrar" onClick={() => setShowSortMenu(false)} className="fixed inset-0 z-10" />
                    <div className="absolute top-[calc(100%+6px)] right-0 z-20 w-52 rounded-xl border border-border-default bg-surface-1 p-1 shadow-[var(--elevation-md)]">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setSortBy(opt.key);
                            setShowSortMenu(false);
                            setMobileVisibleCount(MOBILE_PAGE_SIZE);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-left text-[13.5px]",
                            sortBy === opt.key ? "bg-accent-500/10 font-semibold text-accent-700" : "text-foreground hover:bg-surface-2",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar mini apps">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={chip === c.key}
                  onClick={() => {
                    setChip(c.key);
                    setMobileVisibleCount(MOBILE_PAGE_SIZE);
                  }}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium",
                    c.key === "sin"
                      ? chip === c.key
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10"
                      : chip === c.key
                        ? "border-navy bg-navy text-white"
                        : "border-border-default bg-surface-1 text-neutral-600",
                  )}
                >
                  {c.label}
                  <span className="tabular-nums opacity-75">{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ===== Lista compacta — solo mobile ===== */}
          <div className="flex flex-col gap-0 sm:hidden">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border-default bg-surface-2 p-10 text-center">
                <Users2 className="size-6 text-neutral-400" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">Sin resultados</p>
                <p className="text-xs text-neutral-500">Probá con otro término de búsqueda o filtro.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border-default bg-surface-1">
                {sorted.slice(0, mobileVisibleCount).map((app) => {
                  const visual = miniAppVisual(app);
                  const Icon = visual.icon;
                  const rank = rankByLeads.get(app.id);
                  const hasLeads = app.leadsCount > 0;
                  const conversionPct = Math.round(appConversion(app) * 100);
                  return (
                    <div key={app.id} className="flex items-center gap-3 border-b border-border-default p-3 last:border-b-0">
                      <button type="button" onClick={() => router.push(`/mini-apps/${app.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="relative shrink-0">
                          <span className={cn("flex size-[38px] items-center justify-center rounded-xl", visual.tintBg, visual.tintText)}>
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          {rank && (
                            <span className="absolute -top-1 -left-1 flex size-4 items-center justify-center rounded-full bg-navy text-[9px] font-bold text-white ring-2 ring-surface-1">
                              {rank}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-foreground">{app.name}</p>
                          {hasLeads ? (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="shrink-0 text-[12px] text-neutral-600">
                                <b className="font-semibold text-foreground">{app.leadsCount} leads</b> · {app.visitsCount} visitas · {conversionPct}%
                              </span>
                            </div>
                          ) : (
                            <span className="mt-0.5 inline-flex h-5 items-center rounded-full bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10">
                              {app.visitsCount === 0 ? "Sin visitas" : "Sin leads"}
                            </span>
                          )}
                          {hasLeads && (
                            <div className="mt-1 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-surface-2">
                              <div className={cn("h-full rounded-full", visual.bar)} style={{ width: `${Math.min(100, conversionPct)}%` }} />
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {hasLeads ? (
                          <button
                            type="button"
                            onClick={() => copyLink(app)}
                            aria-label="Copiar link"
                            className="flex size-8 items-center justify-center rounded-lg border border-border-default bg-surface-1 text-neutral-600"
                          >
                            {copiedId === app.id ? <Check className="size-4 text-success-strong" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => shareOnWhatsApp(app)}
                            aria-label="Compartir"
                            className="flex size-8 items-center justify-center rounded-lg border border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10"
                          >
                            <Share2 className="size-4" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActionSheetAppId(app.id)}
                          aria-label="Más opciones"
                          className="flex size-8 items-center justify-center rounded-lg border border-border-default bg-surface-1 text-neutral-600"
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {mobileVisibleCount < sorted.length && (
              <button
                type="button"
                onClick={() => setMobileVisibleCount(sorted.length)}
                className="mt-3 flex items-center justify-center gap-1 text-[13.5px] font-semibold text-accent-600"
              >
                Ver las {sorted.length} mini apps
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* ===== Buscador + vista + chips — solo desktop ===== */}
          <div className="hidden flex-col gap-3 sm:flex">
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
            <div className="hidden flex-col items-center gap-2 rounded-lg border border-border-default bg-surface-2 p-10 text-center sm:flex">
              <Users2 className="size-6 text-neutral-400" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Sin resultados</p>
              <p className="text-xs text-neutral-500">Probá con otro término de búsqueda o filtro.</p>
            </div>
          ) : layout === "grid" ? (
            <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((app) => (
                <MiniAppCard key={app.id} app={app} onDeleted={refetch} canManage={canManage} />
              ))}
            </div>
          ) : (
            <div className="hidden flex-col gap-2 sm:flex">
              {filtered.map((app) => (
                <MiniAppListRow key={app.id} app={app} onDeleted={refetch} canManage={canManage} />
              ))}
            </div>
          )}

          <div className="hidden flex-col items-start gap-3 rounded-lg border border-accent-500/20 bg-accent-500/5 p-5 sm:flex sm:flex-row sm:items-center sm:justify-between">
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

      {/* ===== Hoja "⋯" de una mini app — solo mobile ===== */}
      {actionSheetApp && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden" role="dialog" aria-modal="true" aria-label={actionSheetApp.name}>
          <button type="button" aria-label="Cerrar" onClick={closeActionSheet} className="absolute inset-0 bg-neutral-950/40" />
          <div className="relative flex max-h-[85dvh] w-full flex-col overflow-y-auto rounded-t-2xl bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-[var(--elevation-lg)]">
            <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300" aria-hidden="true" />

            {sheetView === "menu" ? (
              <>
                <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
                  {(() => {
                    const visual = miniAppVisual(actionSheetApp);
                    const Icon = visual.icon;
                    return (
                      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", visual.tintBg, visual.tintText)}>
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[16px] font-semibold text-foreground">{actionSheetApp.name}</h2>
                    <p className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
                      <span className="truncate">{TEMPLATE_KEY_META[actionSheetApp.templateKey]?.label ?? actionSheetApp.templateKey}</span>
                      <span className="shrink-0 text-neutral-300">·</span>
                      <span className={cn("flex shrink-0 items-center gap-1 font-medium", actionSheetApp.status === "active" ? "text-success-strong" : "text-neutral-500")}>
                        <span className={cn("size-1.5 rounded-full", actionSheetApp.status === "active" ? "bg-success-strong" : "bg-neutral-400")} aria-hidden="true" />
                        {actionSheetApp.status === "active" ? "Activa" : "Inactiva"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-5">
                  <div className="rounded-xl bg-surface-2 p-3 text-center">
                    <b className="block font-display text-[19px] font-bold text-foreground">{actionSheetApp.visitsCount}</b>
                    <span className="text-[11px] text-neutral-500">Visitas</span>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3 text-center">
                    <b className="block font-display text-[19px] font-bold text-foreground">{actionSheetApp.leadsCount}</b>
                    <span className="text-[11px] text-neutral-500">Leads</span>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3 text-center">
                    <b className="block font-display text-[19px] font-bold text-foreground">{Math.round(appConversion(actionSheetApp) * 100)}%</b>
                    <span className="text-[11px] text-neutral-500">Conversión</span>
                  </div>
                </div>

                <div className="flex flex-col px-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      shareOnWhatsApp(actionSheetApp);
                      closeActionSheet();
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-surface-2"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                      <Share2 className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-[14.5px] font-medium text-foreground">Compartir por WhatsApp</span>
                  </button>
                  <button type="button" onClick={() => setSheetView("assign")} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-surface-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                      <UserRound className="size-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-[14.5px] font-medium text-foreground">Asignar asesor</span>
                    <span className="shrink-0 truncate text-[13px] text-neutral-500">{actionSheetApp.assignedAgentName ?? "Sin asignar"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/mini-apps/${actionSheetApp.id}?tab=leads`);
                      closeActionSheet();
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-surface-2"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-neutral-600">
                      <Eye className="size-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-[14.5px] font-medium text-foreground">Ver leads de esta app</span>
                    <span className="shrink-0 text-[13px] text-neutral-500">{actionSheetApp.leadsCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/mini-apps/${actionSheetApp.id}?tab=configuracion`);
                      closeActionSheet();
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-surface-2"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-neutral-600">
                      <Pencil className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-[14.5px] font-medium text-foreground">Editar mini app</span>
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => toggleStatus(actionSheetApp)}
                      disabled={isUpdatingApp}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-error-bg disabled:opacity-60"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error-strong">
                        {actionSheetApp.status === "active" ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                      </span>
                      <span className="text-[14.5px] font-medium text-error-strong">{actionSheetApp.status === "active" ? "Pausar" : "Reactivar"}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border-default p-5">
                  <Link
                    href={`/mini-apps/${actionSheetApp.id}`}
                    onClick={closeActionSheet}
                    className="flex h-11 items-center justify-center rounded-xl border border-border-default text-[14px] font-semibold text-foreground"
                  >
                    Ver detalle
                  </Link>
                  <button
                    type="button"
                    onClick={() => copyLink(actionSheetApp)}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent-600 text-[14px] font-semibold text-[var(--on-accent)]"
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    {copiedId === actionSheetApp.id ? "Link copiado" : "Copiar link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-border-default px-5 py-4">
                  <button type="button" onClick={() => setSheetView("menu")} aria-label="Volver" className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-surface-2">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                  <h2 className="text-[16px] font-semibold text-foreground">Asignar asesor</h2>
                </div>
                <div className="flex flex-col px-2 py-2">
                  <button
                    type="button"
                    onClick={() => assignAgent(actionSheetApp, null)}
                    disabled={isUpdatingApp}
                    className="flex items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-surface-2 disabled:opacity-60"
                  >
                    <span className="text-[14.5px] text-foreground">Sin asignar</span>
                    {!actionSheetApp.assignedAgentName && <Check className="size-4 text-accent-600" aria-hidden="true" />}
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.memberId}
                      type="button"
                      onClick={() => assignAgent(actionSheetApp, m.memberId)}
                      disabled={isUpdatingApp}
                      className="flex items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-surface-2 disabled:opacity-60"
                    >
                      <span className="text-[14.5px] text-foreground">{m.fullName}</span>
                      {actionSheetApp.assignedAgentName === m.fullName && <Check className="size-4 text-accent-600" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showCreate && <NewMiniAppWizard members={members} onClose={() => setShowCreate(false)} onCreated={refetch} />}
      {showLinkApp && <LinkAppWizard members={members} onClose={() => setShowLinkApp(false)} onCreated={refetch} />}
    </div>
  );
}
