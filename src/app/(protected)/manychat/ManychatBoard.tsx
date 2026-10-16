"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText, GraduationCap, Landmark, MessageCircle, Package, Pencil, Plus, RefreshCw, Search, Send, SlidersHorizontal, Stethoscope, TrendingDown, TrendingUp, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  CHANNEL_BY_ID,
  STAGES,
  channelBreakdown,
  computeKpis,
  contentRanking,
  funnel,
  leadsBetween,
  periodWindows,
  ratio,
  reached,
  type Kpis,
  type Lead,
  type NormalizedSheet,
  type PeriodId,
  type StageId,
} from "@/lib/manychat/leads";
import { ContentRanking } from "./ContentRanking";
import { LeadEditForm } from "./LeadEditForm";
import { LeadFiles } from "./LeadFiles";
import { Panel } from "./Panel";
import { SheetLinkForm } from "./SheetLinkForm";
import { fmtInt, fmtPct } from "./format";

/** Colores de cada etapa. Se leen bien en claro y en oscuro. */
const STAGE_COLOR: Record<StageId, string> = {
  nuevo: "#c9e6ec",
  contactado: "#8fcfdb",
  calificado: "#13a9bd",
  agenda: "#a78bfa",
  confirmacion: "#f5b942",
  cita: "#6fdae8",
  calendario: "#60a5fa",
  propuesta: "#f472b6",
  cliente: "#3dd68c",
};

const SIN_PRODUCTO = "Sin producto";

/** "Producto" = lead.contenido (la campaña/contenido que generó el lead —
 * mismo campo que ya se muestra debajo del nombre en cada fila). Íconos y
 * colores reconocidos para los productos reales de este workspace, con una
 * paleta de reserva (cíclica por orden de aparición) para cualquier otro
 * contenido que aparezca en la hoja — nunca se oculta un producto por no
 * estar en esta lista. */
const PRODUCT_STYLES: { match: RegExp; icon: LucideIcon; color: string }[] = [
  { match: /gastos?\s*m[eé]dicos?/i, icon: Stethoscope, color: "#0d9488" },
  { match: /\bppr\b/i, icon: Landmark, color: "#7c3aed" },
  { match: /meta\s*universitaria|universidad/i, icon: GraduationCap, color: "#ea580c" },
];
const PRODUCT_FALLBACK_COLORS = ["#2563eb", "#db2777", "#65a30d", "#0891b2", "#9333ea"];

function productStyle(producto: string, fallbackIndex: number): { icon: LucideIcon; color: string } {
  const known = PRODUCT_STYLES.find((p) => p.match.test(producto));
  if (known) return known;
  return { icon: Package, color: PRODUCT_FALLBACK_COLORS[fallbackIndex % PRODUCT_FALLBACK_COLORS.length] };
}

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "7", label: "7d" },
  { id: "30", label: "30d" },
  { id: "90", label: "90d" },
  { id: "all", label: "Todo" },
];

const PAGE_SIZE = 20;

function timeAgo(ms: number, now: number): string {
  const minutes = Math.max(1, Math.round((now - ms) / 60_000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function initials(name: string): string {
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    // Array.from separa por caracteres reales: w[0] parte un emoji en dos y queda "�".
    .map((w) => Array.from(w)[0]?.toUpperCase() ?? "")
    .join("");
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(leads: Lead[]) {
  const stageLabel = Object.fromEntries(STAGES.map((s) => [s.id, s.label]));
  const header = ["Fecha", "Nombre", "Teléfono", "Usuario", "Canal", "Contenido", "Etapa", "Valor"];
  const lines = leads.map((l) =>
    [
      new Date(l.creado).toISOString().slice(0, 16).replace("T", " "),
      l.nombre ?? "",
      l.telefono ?? "",
      l.usuario ?? "",
      (CHANNEL_BY_ID[l.canal] ?? CHANNEL_BY_ID.otros).nombre,
      l.contenido,
      stageLabel[l.etapa],
      l.valor || "",
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-manychat-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function McMark({ className = "size-12 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#5E64D6" />
      <rect x=".5" y=".5" width="23" height="23" rx="6.5" fill="none" stroke="rgba(255,255,255,.18)" />
      <path d="M17.6 11.5a5.6 5.6 0 01-8.3 4.9l-3 .8.8-2.9a5.6 5.6 0 1110.5-2.8z" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12.7 8.4l-2.1 3.3h2.7l-1.9 3.1" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ current, previous, kind, dark }: { current: number | null; previous: number | null; kind: "count" | "pct" | "money"; dark?: boolean }) {
  const mutedClass = dark ? "text-white/40" : "text-neutral-500";
  if (current === null || previous === null) return <small className={cn("text-[12px] font-semibold", mutedClass)}>{previous === null ? "Histórico" : "Sin datos"}</small>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return <small className={cn("text-[12px] font-semibold", mutedClass)}>Igual</small>;
  const up = diff > 0;
  const text = kind === "pct" ? `${fmtPct(Math.abs(diff)).replace("%", "")} pts` : fmtInt(Math.abs(diff));
  return (
    <small className={cn("flex items-center gap-1 text-[12px] font-bold", up ? (dark ? "text-emerald-400" : "text-success-strong") : dark ? "text-rose-400" : "text-error-strong")}>
      {up ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
      {up ? "+" : "-"}
      {text}
    </small>
  );
}

/** Variante del KPI para vivir sobre el fondo navy de la cabecera (sin caja
 * blanca propia), a pedido del usuario — "todo junto" en una sola tarjeta. */
function DarkKpi({ label, value, delta }: { label: string; value: string; delta: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-[12px] text-white/50">{label}</span>
      <span className="flex flex-wrap items-baseline gap-1.5">
        <b className="truncate font-display text-[20px] leading-tight font-extrabold tabular-nums text-white">{value}</b>
        {delta}
      </span>
    </div>
  );
}

/** Tablero de ManyChat: encabezado con estado, acciones y período; indicadores con variación contra el
 * período anterior; lista de leads con búsqueda y etapas; y el embudo, los canales y el contenido. Todo se
 * calcula en el navegador con los leads de la hoja (que el servidor ya leyó). */
export function ManychatBoard({ sheet, sheetUrl, canEdit, generatedAt }: { sheet: NormalizedSheet; sheetUrl: string | null; canEdit: boolean; generatedAt: number }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [period, setPeriod] = useState<PeriodId>("30");
  const [stage, setStage] = useState<StageId | "todos">("todos");
  const [product, setProduct] = useState<string | "todos">("todos");
  const [proj, setProj] = useState<"todas" | "con" | "sin">("todas");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openLead, setOpenLead] = useState<number | null>(null);
  const [editingRef, setEditingRef] = useState<string | null>(null);
  const [showSheetForm, setShowSheetForm] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  // Misma hora que el servidor al renderizar (sin desfase de hidratación); se actualiza al montar.
  const [now, setNow] = useState(generatedAt);
  useEffect(() => {
    Promise.resolve().then(() => setNow(Date.now()));
  }, []);

  const { from, prevFrom, days } = periodWindows(period, now);
  const periodLeads = useMemo(() => leadsBetween(sheet.leads, from, Infinity).sort((a, b) => b.creado - a.creado), [sheet.leads, from]);
  const previousLeads = useMemo(() => (prevFrom === null || from === null ? null : leadsBetween(sheet.leads, prevFrom, from)), [sheet.leads, prevFrom, from]);

  const kpis = useMemo(() => computeKpis(periodLeads, sheet.hasCitas), [periodLeads, sheet.hasCitas]);
  const prev: Kpis | null = useMemo(() => (previousLeads ? computeKpis(previousLeads, sheet.hasCitas) : null), [previousLeads, sheet.hasCitas]);
  const hasMoney = useMemo(() => sheet.leads.some((l) => l.valor > 0), [sheet.leads]);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0])) as Record<StageId, number>;
    for (const l of periodLeads) counts[l.etapa] += 1;
    return counts;
  }, [periodLeads]);

  // "Proyección" = el lead completó una simulación/diagnóstico en alguna Mini
  // App del workspace (mismo teléfono) — lead.proyecciones ya viene armado
  // desde el servidor (getMiniAppProjectionsByPhone, ver manychat/page.tsx).
  const projCounts = useMemo(() => {
    let con = 0;
    let sin = 0;
    for (const l of periodLeads) {
      if ((l.proyecciones?.length ?? 0) > 0) con++;
      else sin++;
    }
    return { con, sin };
  }, [periodLeads]);

  const productStats = useMemo(() => {
    const total = periodLeads.length;
    const prevByProduct = new Map<string, number>();
    if (previousLeads) {
      for (const l of previousLeads) {
        const key = (l.contenido || SIN_PRODUCTO).trim() || SIN_PRODUCTO;
        prevByProduct.set(key, (prevByProduct.get(key) ?? 0) + 1);
      }
    }
    const agg = new Map<string, { producto: string; leads: number; calificados: number; citas: number; proyeccion: number; clientes: number }>();
    for (const l of periodLeads) {
      const key = (l.contenido || SIN_PRODUCTO).trim() || SIN_PRODUCTO;
      const row = agg.get(key) ?? { producto: key, leads: 0, calificados: 0, citas: 0, proyeccion: 0, clientes: 0 };
      row.leads += 1;
      if (reached(l, "calificado")) row.calificados += 1;
      if (sheet.hasCitas && reached(l, "cita")) row.citas += 1;
      if ((l.proyecciones?.length ?? 0) > 0) row.proyeccion += 1;
      if (l.etapa === "cliente") row.clientes += 1;
      agg.set(key, row);
    }
    return [...agg.values()]
      .sort((a, b) => b.leads - a.leads)
      .map((r, i) => ({ ...r, share: ratio(r.leads, total), previous: previousLeads ? (prevByProduct.get(r.producto) ?? 0) : null, ...productStyle(r.producto, i) }));
  }, [periodLeads, previousLeads, sheet.hasCitas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodLeads.filter((l) => {
      if (stage !== "todos" && l.etapa !== stage) return false;
      if (product !== "todos" && ((l.contenido || SIN_PRODUCTO).trim() || SIN_PRODUCTO) !== product) return false;
      const hasProyeccion = (l.proyecciones?.length ?? 0) > 0;
      if (proj === "con" && !hasProyeccion) return false;
      if (proj === "sin" && hasProyeccion) return false;
      if (!q) return true;
      return [l.nombre, l.telefono, l.email, l.usuario, l.nota, l.contenido].some((v) => v?.toLowerCase().includes(q));
    });
  }, [periodLeads, stage, product, proj, search]);

  const steps = useMemo(() => funnel(periodLeads, sheet.hasCitas), [periodLeads, sheet.hasCitas]);
  const channels = useMemo(() => channelBreakdown(periodLeads), [periodLeads]);
  const content = useMemo(() => contentRanking(periodLeads, sheet.hasCitas), [periodLeads, sheet.hasCitas]);

  const minutes = Math.max(0, Math.round((now - generatedAt) / 60_000));
  const statusText = minutes < 1 ? "Conectado, recién" : `Conectado, hace ${minutes} min`;
  const stagesShown = STAGES.filter((s) => s.id !== "cita" || sheet.hasCitas);

  // Producto y proyección viven en la hoja de filtros en móvil (estado ya
  // tiene su propia fila de chips, siempre visible, así que no cuenta acá).
  const activeFilterCount = (product !== "todos" ? 1 : 0) + (proj !== "todas" ? 1 : 0);

  function clearFilters() {
    setProduct("todos");
    setProj("todas");
    setStage("todos");
    setVisible(PAGE_SIZE);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ===== Cabecera compacta — solo mobile (< 640px) ===== */}
      <section className="navy-card rounded-3xl p-4 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <McMark className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-white">ManyChat</p>
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-300" suppressHydrationWarning>
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                {statusText}
              </p>
            </div>
          </div>
          <Link
            href="/crm?crear=1"
            className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white bg-white px-3 text-[13px] font-semibold whitespace-nowrap text-navy"
          >
            <Plus className="size-[14px]" aria-hidden="true" />
            Lead
          </Link>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <div role="group" aria-label="Período" className="flex flex-1 items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.06] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setVisible(PAGE_SIZE);
                }}
                className={cn(
                  "h-8 flex-1 rounded-xl text-[12px] font-semibold transition-colors",
                  period === p.id ? "bg-white text-navy" : "text-white/70",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            aria-label="Actualizar"
            className="flex size-[34px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white disabled:opacity-70"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(periodLeads)}
            aria-label="Exportar"
            className="flex size-[34px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSheetForm((v) => !v)}
              aria-expanded={showSheetForm}
              aria-label="Ajustes de la hoja de ManyChat"
              className="flex size-[34px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {showSheetForm && canEdit && (
          <div className="mt-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-foreground">
            <div className="rounded-xl bg-surface-1 p-4">
              <SheetLinkForm currentUrl={sheetUrl} />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-stretch divide-x divide-white/10 border-t border-white/10 pt-3">
          {(
            [
              ["Leads", fmtInt(kpis.leads), kpis.leads, prev?.leads ?? null, "count"],
              ["Calif.", fmtInt(kpis.calificados), kpis.calificados, prev?.calificados ?? null, "count"],
              ["Citas", kpis.citas === null ? "—" : fmtInt(kpis.citas), kpis.citas, prev ? prev.citas : null, "count"],
              ["Clientes", fmtInt(kpis.clientes), kpis.clientes, prev?.clientes ?? null, "count"],
              ["Conv.", fmtPct(kpis.conversion), kpis.conversion, prev?.conversion ?? null, "pct"],
            ] as [string, string, number | null, number | null, "count" | "pct"][]
          ).map(([label, value, current, previous, kind]) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-0.5 px-1 text-center">
              <b className="font-display text-[17px] leading-none font-extrabold tabular-nums text-white">{value}</b>
              <span className="text-[10.5px] text-white/50">{label}</span>
              <Delta current={current} previous={previous} kind={kind} dark />
            </div>
          ))}
        </div>
      </section>

      {/* ===== Cabecera completa — solo desktop (>= 640px) ===== */}
      <section className="navy-card hidden rounded-3xl p-4 sm:block sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <McMark />
          <div className="min-w-0">
            <h1 className="font-display text-[20px] leading-none font-extrabold tracking-[-0.03em] text-white">ManyChat</h1>
            <p className="mt-1 text-[13px] text-white/70">Leads de Instagram y WhatsApp</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Período" className="flex items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.06] p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={period === p.id}
                  onClick={() => {
                    setPeriod(p.id);
                    setVisible(PAGE_SIZE);
                  }}
                  className={cn(
                    "h-8 shrink-0 rounded-xl px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
                    period === p.id ? "bg-white text-navy" : "text-white/70 hover:text-white",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
              aria-label="Actualizar"
              title="Actualizar"
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-70"
            >
              <RefreshCw className={cn("size-[18px]", refreshing && "animate-spin")} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(periodLeads)}
              aria-label="Exportar"
              title="Exportar"
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Download className="size-[18px]" aria-hidden="true" />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowSheetForm((v) => !v)}
                aria-expanded={showSheetForm}
                aria-label="Ajustes de la hoja de ManyChat"
                title="Ajustes"
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <SlidersHorizontal className="size-[18px]" aria-hidden="true" />
              </button>
            )}
            <Link
              href="/crm?crear=1"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl border border-white bg-white px-4 text-[13.5px] font-semibold whitespace-nowrap text-navy"
            >
              <Plus className="size-[16px]" aria-hidden="true" />
              Lead
            </Link>
          </div>
        </div>

        <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-400/15 px-3.5 py-1.5 text-[13.5px] font-semibold text-emerald-300">
          <span className="size-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
          <span className="truncate">{statusText}</span>
        </p>

        {showSheetForm && canEdit && (
          <div className="mt-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-foreground">
            <div className="rounded-xl bg-surface-1 p-4">
              <SheetLinkForm currentUrl={sheetUrl} />
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-4 border-t border-white/10 pt-4 sm:grid-cols-5">
          <DarkKpi label="Leads" value={fmtInt(kpis.leads)} delta={<Delta current={kpis.leads} previous={prev?.leads ?? null} kind="count" dark />} />
          <DarkKpi label="Calificados" value={fmtInt(kpis.calificados)} delta={<Delta current={kpis.calificados} previous={prev?.calificados ?? null} kind="count" dark />} />
          <DarkKpi
            label="Citas"
            value={kpis.citas === null ? "—" : fmtInt(kpis.citas)}
            delta={<Delta current={kpis.citas} previous={prev ? prev.citas : null} kind="count" dark />}
          />
          <DarkKpi label="Clientes" value={fmtInt(kpis.clientes)} delta={<Delta current={kpis.clientes} previous={prev?.clientes ?? null} kind="count" dark />} />
          <DarkKpi label="Conversión" value={fmtPct(kpis.conversion)} delta={<Delta current={kpis.conversion} previous={prev?.conversion ?? null} kind="pct" dark />} />
          {hasMoney && (
            <DarkKpi label="Ingresos" value={fmtInt(kpis.ingresos)} delta={<Delta current={kpis.ingresos} previous={prev?.ingresos ?? null} kind="money" dark />} />
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-white/40">
          {days === null ? "Desde el primer lead de la hoja" : `Cambios contra los ${days} días anteriores`}
        </p>
      </section>

      {/* ===== Por producto — mobile ===== */}
      {productStats.length > 0 && (
        <div className="sm:hidden">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h2 className="font-display text-[17px] font-semibold text-foreground">Por producto</h2>
            <span className="shrink-0 text-[12px] text-neutral-500">Tocá para filtrar</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {productStats.map((p) => {
              const Icon = p.icon;
              const selected = product === p.producto;
              return (
                <button
                  key={p.producto}
                  type="button"
                  onClick={() => {
                    setProduct(selected ? "todos" : p.producto);
                    setVisible(PAGE_SIZE);
                  }}
                  aria-pressed={selected}
                  className={cn("flex flex-col gap-1.5 rounded-xl border-2 bg-surface-1 p-2.5 text-left", !selected && "border-border-default")}
                  style={selected ? { borderColor: p.color } : undefined}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${p.color}1a`, color: p.color }}>
                      <Icon className="size-[13px]" aria-hidden="true" />
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-neutral-500">{fmtPct(p.share)}</span>
                  </div>
                  <b className="font-display text-[19px] leading-none font-extrabold text-foreground">{fmtInt(p.leads)}</b>
                  <p className="truncate text-[11.5px] font-medium text-neutral-600">{p.producto}</p>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.share)}%`, backgroundColor: p.color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Leads por producto — desktop ===== */}
      {productStats.length > 0 && (
        <div className="hidden sm:block">
        <Panel title="Leads por producto" subtitle="Tocá un producto para filtrar la lista">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {productStats.map((p) => {
              const Icon = p.icon;
              const selected = product === p.producto;
              return (
                <button
                  key={p.producto}
                  type="button"
                  onClick={() => {
                    setProduct(selected ? "todos" : p.producto);
                    setVisible(PAGE_SIZE);
                  }}
                  aria-pressed={selected}
                  className={cn("flex flex-col gap-3 rounded-2xl border-2 bg-surface-1 p-4 text-left", selected ? "" : "border-border-default")}
                  style={selected ? { borderColor: p.color } : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${p.color}1a`, color: p.color }}>
                        <Icon className="size-[18px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-foreground">{p.producto}</p>
                        <p className="text-[12px] text-neutral-500">{fmtPct(p.share)} de los leads</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <b className="block font-display text-[26px] leading-none font-extrabold tabular-nums text-foreground">{fmtInt(p.leads)}</b>
                      <Delta current={p.leads} previous={p.previous} kind="count" />
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.share)}%`, backgroundColor: p.color }} />
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className="text-[11px] text-neutral-500">Calificados</p>
                      <b className="text-[14px] font-bold text-foreground">{p.calificados}</b>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500">Citas</p>
                      <b className="text-[14px] font-bold text-foreground">{sheet.hasCitas ? p.citas : "—"}</b>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500">Proyección</p>
                      <b className="text-[14px] font-bold text-foreground">{p.proyeccion}</b>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500">Clientes</p>
                      <b className="text-[14px] font-bold text-foreground">{p.clientes}</b>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
        </div>
      )}

      <Panel
        title="Tus leads"
        action={
          <span className="shrink-0 rounded-full bg-accent-500/15 px-3 py-1 text-[12.5px] font-semibold text-accent-700 tabular-nums">
            {fmtInt(filtered.length)} de {fmtInt(periodLeads.length)}
          </span>
        }
      >
        <div className="flex items-center gap-2">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <span className="sr-only">Buscar leads</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Nombre, teléfono o nota"
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-border-default bg-surface-1 pr-3 pl-11 text-base text-foreground outline-none placeholder:text-neutral-400 focus:border-accent-500"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilterSheet(true)}
            className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-border-default bg-surface-1 px-3.5 text-[13.5px] font-semibold text-foreground sm:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-accent-600 text-[11px] font-bold text-[var(--on-accent)]">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 sm:hidden">
            {product !== "todos" && (
              <button
                type="button"
                onClick={() => {
                  setProduct("todos");
                  setVisible(PAGE_SIZE);
                }}
                className="flex h-7 items-center gap-1 rounded-full bg-surface-2 pr-2 pl-3 text-[12.5px] font-semibold text-neutral-700"
              >
                {product}
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
            {proj !== "todas" && (
              <button
                type="button"
                onClick={() => {
                  setProj("todas");
                  setVisible(PAGE_SIZE);
                }}
                className="flex h-7 items-center gap-1 rounded-full bg-surface-2 pr-2 pl-3 text-[12.5px] font-semibold text-neutral-700"
              >
                {proj === "con" ? "Con proyección" : "Sin proyección"}
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por etapa">
          {([["todos", "Todos", periodLeads.length], ...stagesShown.map((s) => [s.id, s.label, stageCounts[s.id]])] as [StageId | "todos", string, number][]).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              aria-pressed={stage === id}
              onClick={() => {
                setStage(id);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold",
                stage === id ? "border-navy bg-navy text-white dark:border-[#1c2858] dark:bg-[#1c2858]" : "border-border-default bg-surface-1 text-neutral-600",
              )}
            >
              {label}
              <span className="text-[12.5px] font-bold tabular-nums opacity-75">{count}</span>
            </button>
          ))}
        </div>

        <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-border-default pt-3 sm:flex">
        {productStats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por producto">
            <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">Producto:</span>
            <button
              type="button"
              aria-pressed={product === "todos"}
              onClick={() => {
                setProduct("todos");
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold",
                product === "todos" ? "border-navy bg-navy text-white dark:border-[#1c2858] dark:bg-[#1c2858]" : "border-border-default bg-surface-1 text-neutral-600",
              )}
            >
              Todos
              <span className="text-[12px] font-bold tabular-nums opacity-75">{periodLeads.length}</span>
            </button>
            {productStats.map((p) => {
              const selected = product === p.producto;
              return (
                <button
                  key={p.producto}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setProduct(selected ? "todos" : p.producto);
                    setVisible(PAGE_SIZE);
                  }}
                  className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-surface-1 px-3.5 text-[13.5px] font-semibold", !selected && "border-border-default")}
                  style={selected ? { borderColor: p.color, color: p.color } : undefined}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
                  <span className={selected ? "" : "text-neutral-600"}>{p.producto}</span>
                  <span className="text-[12px] font-bold tabular-nums opacity-75">{p.leads}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="hidden h-6 w-px bg-border-default sm:block" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por proyección">
          <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">Proyección:</span>
          {(
            [
              ["todas", "Todas", null],
              ["con", `✓ Con proyección`, projCounts.con],
              ["sin", `○ Sin proyección`, projCounts.sin],
            ] as [typeof proj, string, number | null][]
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              aria-pressed={proj === id}
              onClick={() => {
                setProj(id);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold",
                id === "todas" && (proj === id ? "border-navy bg-navy text-white dark:border-[#1c2858] dark:bg-[#1c2858]" : "border-border-default bg-surface-1 text-neutral-600"),
                id === "con" && (proj === id ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-500 bg-surface-1 text-emerald-700"),
                id === "sin" && (proj === id ? "border-amber-500 bg-amber-500 text-white" : "border-amber-500 bg-surface-1 text-amber-700"),
              )}
            >
              {label}
              {count !== null && <span className="text-[12px] font-bold tabular-nums opacity-75">{count}</span>}
            </button>
          ))}
        </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default bg-surface-2 p-6 text-center text-sm text-neutral-500">
            <b className="mb-1 block text-foreground">No hay leads con ese filtro</b>
            Probá con otra etapa, otro período o borrá la búsqueda.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.slice(0, visible).map((lead, i) => {
              const channel = CHANNEL_BY_ID[lead.canal] ?? CHANNEL_BY_ID.otros;
              const name = lead.nombre || "Sin nombre";
              const open = openLead === i;
              const editing = open && editingRef === lead.ref;
              const digits = (lead.telefono ?? "").replace(/\D/g, "");
              const hasDetail = Boolean(lead.telefono || lead.email || lead.usuario || lead.nota);
              const prodKey = (lead.contenido || SIN_PRODUCTO).trim() || SIN_PRODUCTO;
              const prodColor = productStats.find((p) => p.producto === prodKey)?.color ?? "#6b7280";
              const hasProyeccion = (lead.proyecciones?.length ?? 0) > 0;
              return (
                <li key={`${lead.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLead(open ? null : i);
                      setEditingRef(null);
                    }}
                    aria-expanded={open}
                    className="hidden w-full grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border-default bg-surface-1 p-3 text-left sm:grid"
                  >
                    <span
                      className="relative flex size-[46px] items-center justify-center rounded-full text-[15px] font-bold"
                      style={{ backgroundColor: `${channel.color}22`, color: channel.color }}
                    >
                      {initials(name) || "?"}
                      <span className="absolute -right-0.5 -bottom-0.5 size-[14px] rounded-full ring-2 ring-surface-1" style={{ backgroundColor: channel.color }} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[16px] font-semibold text-foreground">{name}</span>
                        <span className="shrink-0 text-[12.5px] text-neutral-500" suppressHydrationWarning>
                          {timeAgo(lead.creado, now)}
                        </span>
                      </span>
                      <span className="mt-0.5 mb-2 block truncate text-[14px] text-neutral-500">{lead.contenido}</span>
                      <span className="flex flex-wrap gap-1.5">
                        <span className="inline-flex h-6 items-center rounded-full bg-accent-500/15 px-2.5 text-[12.5px] font-semibold text-accent-700">
                          {STAGES.find((s) => s.id === lead.etapa)?.label}
                        </span>
                        <span className="inline-flex h-6 items-center rounded-full border border-border-default px-2.5 text-[12.5px] font-semibold text-neutral-600">{channel.corto}</span>
                        {lead.editado && (
                          <span className="inline-flex h-6 items-center rounded-full border border-dashed border-border-default px-2.5 text-[12.5px] font-medium text-neutral-500">Editado</span>
                        )}
                      </span>
                    </span>
                    {hasProyeccion ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 dark:bg-emerald-500/10">
                        <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                        Proyección ✓
                        <span className="opacity-75">· {lead.proyecciones!.length} PDF{lead.proyecciones!.length === 1 ? "" : "s"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500 bg-amber-50 px-3 py-1.5 text-[12.5px] font-semibold text-amber-700 dark:bg-amber-500/10">
                        ○ Sin proyección
                      </span>
                    )}
                  </button>

                  {/* ===== Fila compacta — solo mobile ===== */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLead(open ? null : i);
                      setEditingRef(null);
                    }}
                    aria-expanded={open}
                    className="flex w-full items-start gap-3 border-b border-border-default py-3 text-left sm:hidden"
                  >
                    <span
                      className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                      style={{ backgroundColor: `${channel.color}22`, color: channel.color }}
                    >
                      {initials(name) || "?"}
                      <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-surface-1" style={{ backgroundColor: channel.color }} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-semibold text-foreground">{name}</span>
                        <span className="shrink-0 text-[12px] text-neutral-500" suppressHydrationWarning>
                          {timeAgo(lead.creado, now)}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="flex min-w-0 items-center gap-1 text-[12px] font-semibold" style={{ color: prodColor }}>
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: prodColor }} aria-hidden="true" />
                          <span className="truncate">{prodKey}</span>
                        </span>
                        <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent-500/15 px-2 text-[11px] font-semibold text-accent-700">
                          {STAGES.find((s) => s.id === lead.etapa)?.label}
                        </span>
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: channel.color }} title={channel.nombre}>
                          <MessageCircle className="size-2.5 text-white" aria-hidden="true" />
                        </span>
                        {hasProyeccion ? (
                          <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10">✓ Proy.</span>
                        ) : (
                          <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-amber-50 px-2 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10">Sin proy.</span>
                        )}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="mx-1 -mt-1 flex flex-col gap-2 rounded-b-2xl border border-t-0 border-border-default bg-surface-2 p-3 text-[13.5px] text-neutral-600">
                      {editing ? (
                        <LeadEditForm lead={lead} onDone={() => setEditingRef(null)} />
                      ) : (
                        <>
                          {hasDetail ? (
                            <>
                              {lead.telefono && <p>Teléfono: <span className="text-foreground">{lead.telefono}</span></p>}
                              {lead.email && <p>Email: <span className="text-foreground">{lead.email}</span></p>}
                              {lead.usuario && <p>Usuario: <span className="text-foreground">{lead.usuario}</span></p>}
                              {lead.nota && <p>Nota: <span className="text-foreground">{lead.nota}</span></p>}
                            </>
                          ) : (
                            <p>Todavía no hay teléfono, email, usuario ni notas de este lead.</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {digits && (
                              <a
                                href={`https://wa.me/${digits}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-accent-600 px-4 text-[14px] font-semibold text-[var(--on-accent)] hover:bg-accent-700"
                              >
                                <Send className="size-4" aria-hidden="true" />
                                Escribir por WhatsApp
                              </a>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setEditingRef(lead.ref)}
                                className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-4 text-[14px] font-semibold text-foreground hover:border-border-strong"
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                                Editar
                              </button>
                            )}
                          </div>
                          <LeadFiles lead={lead} canEdit={canEdit} />
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > visible && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="h-11 rounded-xl border border-border-default bg-surface-1 text-[14px] font-semibold text-foreground hover:border-border-strong"
          >
            Ver más ({fmtInt(filtered.length - visible)})
          </button>
        )}
      </Panel>

      {/* ===== Hoja de filtros — solo mobile ===== */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <button type="button" aria-label="Cerrar filtros" onClick={() => setShowFilterSheet(false)} className="absolute inset-0 bg-neutral-950/40" />
          <div className="relative flex max-h-[85dvh] w-full flex-col overflow-y-auto rounded-t-2xl bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-[var(--elevation-lg)]">
            <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
              <h2 className="text-[17px] font-semibold text-foreground">Filtros</h2>
              <button type="button" onClick={clearFilters} className="text-[13.5px] font-semibold text-accent-600 hover:underline">
                Limpiar
              </button>
            </div>

            <div className="flex flex-col gap-5 p-5">
              {productStats.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">Producto</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={product === "todos"}
                      onClick={() => {
                        setProduct("todos");
                        setVisible(PAGE_SIZE);
                      }}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold",
                        product === "todos" ? "border-navy bg-navy text-white dark:border-[#1c2858] dark:bg-[#1c2858]" : "border-border-default bg-surface-1 text-neutral-600",
                      )}
                    >
                      Todos
                      <span className="text-[12px] font-bold tabular-nums opacity-75">{periodLeads.length}</span>
                    </button>
                    {productStats.map((p) => {
                      const selected = product === p.producto;
                      return (
                        <button
                          key={p.producto}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setProduct(selected ? "todos" : p.producto);
                            setVisible(PAGE_SIZE);
                          }}
                          className={cn("flex h-9 items-center gap-1.5 rounded-full border bg-surface-1 px-3.5 text-[13.5px] font-semibold", !selected && "border-border-default")}
                          style={selected ? { borderColor: p.color, color: p.color } : undefined}
                        >
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
                          <span className={selected ? "" : "text-neutral-600"}>{p.producto}</span>
                          <span className="text-[12px] font-bold tabular-nums opacity-75">{p.leads}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">Proyección</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["todas", "Todas", null],
                      ["con", `✓ Con proyección`, projCounts.con],
                      ["sin", `○ Sin proyección`, projCounts.sin],
                    ] as [typeof proj, string, number | null][]
                  ).map(([id, label, count]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={proj === id}
                      onClick={() => {
                        setProj(id);
                        setVisible(PAGE_SIZE);
                      }}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold",
                        id === "todas" && (proj === id ? "border-navy bg-navy text-white dark:border-[#1c2858] dark:bg-[#1c2858]" : "border-border-default bg-surface-1 text-neutral-600"),
                        id === "con" && (proj === id ? "border-emerald-500 bg-emerald-500 text-white" : "border-emerald-500 bg-surface-1 text-emerald-700"),
                        id === "sin" && (proj === id ? "border-amber-500 bg-amber-500 text-white" : "border-amber-500 bg-surface-1 text-amber-700"),
                      )}
                    >
                      {label}
                      {count !== null && <span className="text-[12px] font-bold tabular-nums opacity-75">{count}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">Estado</span>
                <div className="flex flex-wrap gap-2">
                  {([["todos", "Todos", periodLeads.length], ...stagesShown.map((s) => [s.id, s.label, stageCounts[s.id]])] as [StageId | "todos", string, number][]).map(([id, label, count]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={stage === id}
                      onClick={() => {
                        setStage(id);
                        setVisible(PAGE_SIZE);
                      }}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold",
                        stage === id ? "border-navy bg-navy text-white dark:border-[#1c2858] dark:bg-[#1c2858]" : "border-border-default bg-surface-1 text-neutral-600",
                      )}
                    >
                      {label}
                      <span className="text-[12px] font-bold tabular-nums opacity-75">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border-default p-5">
              <button
                type="button"
                onClick={() => setShowFilterSheet(false)}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-accent-600 text-[15px] font-bold text-[var(--on-accent)] hover:bg-accent-700"
              >
                Ver {fmtInt(filtered.length)} leads
              </button>
            </div>
          </div>
        </div>
      )}

      <Panel title="Embudo" subtitle="Hasta qué etapa llegaron los leads del período.">
        <ol className="flex flex-col gap-4">
          {steps.map((step) => (
            <li key={step.id} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">{step.label}</p>
                {step.na ? (
                  <p className="text-[11px] text-neutral-500">Sin datos de citas</p>
                ) : step.passRate !== null ? (
                  <p className="text-[11px] font-semibold text-accent-700">{fmtPct(step.passRate)} pasa</p>
                ) : null}
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <i className="block h-full rounded-full" style={{ width: `${step.na ? 0 : step.share}%`, backgroundColor: STAGE_COLOR[step.id] }} />
              </div>
              <span className="w-10 text-right font-display text-[18px] font-semibold tabular-nums text-foreground">{step.na ? "—" : fmtInt(step.count)}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Etapa por canal" subtitle="En qué etapa están hoy los leads de cada canal.">
        <ul className="flex flex-col gap-4">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                  {c.nombre}
                </span>
                <span className="text-[12px] text-neutral-500 tabular-nums">
                  {fmtInt(c.leads)} leads{c.clientes > 0 ? `, ${fmtInt(c.clientes)} ${c.clientes === 1 ? "cliente" : "clientes"}` : ""}
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={stagesShown.map((s) => `${s.label}: ${c.porEtapa[s.id]}`).join(", ")}>
                {stagesShown.map((s) => (
                  <i key={s.id} className="block h-full" style={{ width: `${ratio(c.porEtapa[s.id], c.leads)}%`, backgroundColor: STAGE_COLOR[s.id] }} />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-neutral-600">
          {stagesShown.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm" style={{ backgroundColor: STAGE_COLOR[s.id] }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      </Panel>

      <ContentRanking rows={content} hasCitas={sheet.hasCitas} />

      <footer className="flex flex-col items-center gap-2 pb-4 text-center text-[12px] text-neutral-500">
        <p>Datos de tu hoja de ManyChat{sheet.skipped > 0 ? ` · ${fmtInt(sheet.skipped)} filas sin fecha se omitieron` : ""}.</p>
        <Link href="/manychat/completo" className="font-medium text-accent-700 hover:underline">
          Ver tablero completo
        </Link>
      </footer>
    </div>
  );
}
