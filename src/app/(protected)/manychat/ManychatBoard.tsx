"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, RefreshCw, Search, Send, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react";
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
  type Kpis,
  type Lead,
  type NormalizedSheet,
  type PeriodId,
  type StageId,
} from "@/lib/manychat/leads";
import { ContentRanking } from "./ContentRanking";
import { Panel } from "./Panel";
import { SheetLinkForm } from "./SheetLinkForm";
import { fmtInt, fmtPct } from "./format";

/** Colores de cada etapa. Se leen bien en claro y en oscuro. */
const STAGE_COLOR: Record<StageId, string> = {
  nuevo: "#c9e6ec",
  contactado: "#8fcfdb",
  calificado: "#13a9bd",
  cita: "#6fdae8",
  cliente: "#3dd68c",
};

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "7", label: "7 días" },
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
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
    .map((w) => w[0]?.toUpperCase() ?? "")
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

function McMark() {
  return (
    <svg className="size-12 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#5E64D6" />
      <rect x=".5" y=".5" width="23" height="23" rx="6.5" fill="none" stroke="rgba(255,255,255,.18)" />
      <path d="M17.6 11.5a5.6 5.6 0 01-8.3 4.9l-3 .8.8-2.9a5.6 5.6 0 1110.5-2.8z" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12.7 8.4l-2.1 3.3h2.7l-1.9 3.1" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ current, previous, kind }: { current: number | null; previous: number | null; kind: "count" | "pct" | "money" }) {
  if (current === null || previous === null) return <small className="text-[12px] font-semibold text-neutral-500">{previous === null ? "Histórico" : "Sin datos"}</small>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) return <small className="text-[12px] font-semibold text-neutral-500">Igual</small>;
  const up = diff > 0;
  const text = kind === "pct" ? `${fmtPct(Math.abs(diff)).replace("%", "")} pts` : fmtInt(Math.abs(diff));
  return (
    <small className={cn("flex items-center gap-1 text-[12px] font-bold", up ? "text-success-strong" : "text-error-strong")}>
      {up ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
      {up ? "+" : "-"}
      {text}
    </small>
  );
}

function KpiTile({ label, value, delta }: { label: string; value: string; delta: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-xs)]">
      <span className="truncate text-[12px] text-neutral-500">{label}</span>
      <b className="truncate font-display text-[22px] leading-tight font-extrabold tabular-nums text-foreground">{value}</b>
      {delta}
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
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openLead, setOpenLead] = useState<number | null>(null);
  const [showSheetForm, setShowSheetForm] = useState(false);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodLeads.filter((l) => {
      if (stage !== "todos" && l.etapa !== stage) return false;
      if (!q) return true;
      return [l.nombre, l.telefono, l.usuario, l.nota, l.contenido].some((v) => v?.toLowerCase().includes(q));
    });
  }, [periodLeads, stage, search]);

  const steps = useMemo(() => funnel(periodLeads, sheet.hasCitas), [periodLeads, sheet.hasCitas]);
  const channels = useMemo(() => channelBreakdown(periodLeads), [periodLeads]);
  const content = useMemo(() => contentRanking(periodLeads, sheet.hasCitas), [periodLeads, sheet.hasCitas]);

  const minutes = Math.max(0, Math.round((now - generatedAt) / 60_000));
  const statusText = minutes < 1 ? "Conectado, recién" : `Conectado, hace ${minutes} min`;
  const stagesShown = STAGES.filter((s) => s.id !== "cita" || sheet.hasCitas);

  return (
    <div className="flex flex-col gap-4">
      <section className="navy-card rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <McMark />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[28px] leading-none font-extrabold tracking-[-0.03em] text-white">ManyChat</h1>
            <p className="mt-1 text-sm text-white/70">Leads de Instagram y WhatsApp</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSheetForm((v) => !v)}
              aria-expanded={showSheetForm}
              aria-label="Ajustes de la hoja de ManyChat"
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white hover:bg-white/10"
            >
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </button>
          )}
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

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link
            href="/crm?crear=1"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white bg-white text-[14px] font-semibold text-navy"
          >
            <Plus className="size-[18px]" aria-hidden="true" />
            Lead
          </Link>
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-[14px] font-semibold text-white hover:bg-white/10 disabled:opacity-70"
          >
            <RefreshCw className={cn("size-[18px]", refreshing && "animate-spin")} aria-hidden="true" />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(periodLeads)}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-[14px] font-semibold text-white hover:bg-white/10"
          >
            <Download className="size-[18px]" aria-hidden="true" />
            Exportar
          </button>
        </div>

        <div role="group" aria-label="Período" className="mt-3 grid grid-cols-4 gap-0.5 rounded-2xl border border-white/10 bg-white/[0.06] p-1">
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
                "h-10 rounded-xl text-[13.5px] font-semibold transition-colors",
                period === p.id ? "bg-white text-navy" : "text-white/70 hover:text-white",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        <KpiTile label="Leads" value={fmtInt(kpis.leads)} delta={<Delta current={kpis.leads} previous={prev?.leads ?? null} kind="count" />} />
        <KpiTile label="Calificados" value={fmtInt(kpis.calificados)} delta={<Delta current={kpis.calificados} previous={prev?.calificados ?? null} kind="count" />} />
        <KpiTile
          label="Citas"
          value={kpis.citas === null ? "—" : fmtInt(kpis.citas)}
          delta={<Delta current={kpis.citas} previous={prev ? prev.citas : null} kind="count" />}
        />
        <KpiTile label="Clientes" value={fmtInt(kpis.clientes)} delta={<Delta current={kpis.clientes} previous={prev?.clientes ?? null} kind="count" />} />
        <KpiTile label="Conversión" value={fmtPct(kpis.conversion)} delta={<Delta current={kpis.conversion} previous={prev?.conversion ?? null} kind="pct" />} />
        {hasMoney && (
          <KpiTile label="Ingresos" value={fmtInt(kpis.ingresos)} delta={<Delta current={kpis.ingresos} previous={prev?.ingresos ?? null} kind="money" />} />
        )}
      </div>
      <p className="-mt-2 px-1 text-[12.5px] text-neutral-500">
        {days === null ? "Desde el primer lead de la hoja" : `Cambios contra los ${days} días anteriores`}
      </p>

      <Panel
        title="Tus leads"
        action={
          <span className="shrink-0 rounded-full bg-accent-500/15 px-3 py-1 text-[12.5px] font-semibold text-accent-700 tabular-nums">
            {fmtInt(filtered.length)} de {fmtInt(periodLeads.length)}
          </span>
        }
      >
        <label className="relative block">
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

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default bg-surface-2 p-6 text-center text-sm text-neutral-500">
            <b className="mb-1 block text-foreground">No hay leads con ese filtro</b>
            Probá con otra etapa, otro período o borrá la búsqueda.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.slice(0, visible).map((lead, i) => {
              const channel = CHANNEL_BY_ID[lead.canal] ?? CHANNEL_BY_ID.otros;
              const name = lead.nombre ?? "Sin nombre";
              const open = openLead === i;
              const digits = (lead.telefono ?? "").replace(/\D/g, "");
              const hasDetail = Boolean(lead.telefono || lead.usuario || lead.nota);
              return (
                <li key={`${lead.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setOpenLead(open ? null : i)}
                    aria-expanded={open}
                    className="grid w-full grid-cols-[46px_minmax(0,1fr)] gap-3 rounded-2xl border border-border-default bg-surface-1 p-3 text-left"
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
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="mx-1 -mt-1 flex flex-col gap-2 rounded-b-2xl border border-t-0 border-border-default bg-surface-2 p-3 text-[13.5px] text-neutral-600">
                      {hasDetail ? (
                        <>
                          {lead.telefono && <p>Teléfono: <span className="text-foreground">{lead.telefono}</span></p>}
                          {lead.usuario && <p>Usuario: <span className="text-foreground">{lead.usuario}</span></p>}
                          {lead.nota && <p>Nota: <span className="text-foreground">{lead.nota}</span></p>}
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
                        </>
                      ) : (
                        <p>La hoja no trae teléfono, usuario ni notas de este lead.</p>
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
