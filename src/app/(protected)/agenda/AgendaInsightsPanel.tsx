"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CalendarCheck2, CheckCircle2, XCircle, Ban, TrendingUp, Percent, ArrowUp, ArrowDown, Loader2, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAgendaPerformanceAction } from "@/lib/agenda/actions";
import type { AgendaPerformance } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { getMonday } from "@/lib/calendar/week";

type Preset = "week" | "month" | "year";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "year", label: "Este año" },
];

/** Mismo cálculo que AgendaKpisSection.tsx (kpis/), reimplementado acá
 * porque ese archivo es un panel de análisis distinto (KPIs → Agendas,
 * ruta separada) — este panel vive embebido en /agenda mismo. */
function rangeForPreset(preset: Preset): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start: Date;
  if (preset === "week") start = getMonday(now);
  else if (preset === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  else start = new Date(now.getFullYear(), 0, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

const ESTADO_DONUT_COLOR: Record<(typeof ESTADO_CITA_OPTIONS)[number], string> = {
  agendada: "var(--color-warning)",
  confirmada: "var(--color-info)",
  realizada: "var(--color-success)",
  no_show: "var(--color-error)",
  cancelada: "var(--color-neutral-400)",
  venta: "var(--color-accent-500)",
};

/** true = un aumento de esta métrica es una buena noticia (verde);
 * No Show/Canceladas son al revés (bajar es la buena noticia). */
const HIGHER_IS_BETTER: Record<string, boolean> = { total: true, realizada: true, venta: true, no_show: false, cancelada: false, conversion: true };

function Delta({ current, previous, metricKey }: { current: number; previous: number | null; metricKey: string }) {
  if (previous === null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  const higherIsBetter = HIGHER_IS_BETTER[metricKey] ?? true;
  const isGood = pct > 0 ? higherIsBetter : !higherIsBetter;
  const Icon = pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-medium ${isGood ? "text-success-strong" : "text-error-strong"}`}>
      <Icon size={11} aria-hidden="true" />
      {Math.abs(pct)}% vs período anterior
    </span>
  );
}

function Tile({ icon: Icon, label, value, delta }: { icon: React.ElementType; label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-surface-1 p-3">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
          <Icon className="size-3.5" aria-hidden="true" />
        </div>
        <p className="text-[11.5px] text-neutral-500">{label}</p>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      {delta}
    </div>
  );
}

/** Panel derecho de /agenda: KPIs automáticos + "Citas por Estado" (donut,
 * colores de estado — mismos que las badges de CitaCard) + "Citas por Tipo"
 * (barras horizontales, magnitud, un solo tono). Todo derivado de
 * getAgendaPerformanceAction — nada hardcodeado ni de ejemplo. */
export function AgendaInsightsPanel() {
  const [preset, setPreset] = useState<Preset>("month");
  const [data, setData] = useState<AgendaPerformance | null>(null);
  const [loading, startTransition] = useTransition();

  const range = useMemo(() => rangeForPreset(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await getAgendaPerformanceAction(range);
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const conversion = data && data.totals.total > 0 ? Math.round((data.totals.venta / data.totals.total) * 100) : 0;
  const prevConversion = data?.previousTotals && data.previousTotals.total > 0 ? Math.round((data.previousTotals.venta / data.previousTotals.total) * 100) : null;

  const donutData = data ? ESTADO_CITA_OPTIONS.map((e) => ({ key: e, label: ESTADO_CITA_META[e].label, count: data.totals[e] })).filter((d) => d.count > 0) : [];

  const maxTypeCount = data && data.byType.length > 0 ? Math.max(...data.byType.map((t) => t.count)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="KPIs Automáticos"
          action={
            <Select label="" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} containerClassName="w-auto">
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          }
        />
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Cargando…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Tile icon={CalendarCheck2} label="Citas Recibidas" value={String(data?.totals.total ?? 0)} delta={<Delta current={data?.totals.total ?? 0} previous={data?.previousTotals?.total ?? null} metricKey="total" />} />
            <Tile
              icon={CheckCircle2}
              label="Citas Realizadas"
              value={String(data?.totals.realizada ?? 0)}
              delta={<Delta current={data?.totals.realizada ?? 0} previous={data?.previousTotals?.realizada ?? null} metricKey="realizada" />}
            />
            <Tile icon={XCircle} label="No Shows" value={String(data?.totals.no_show ?? 0)} delta={<Delta current={data?.totals.no_show ?? 0} previous={data?.previousTotals?.no_show ?? null} metricKey="no_show" />} />
            <Tile
              icon={Ban}
              label="Canceladas"
              value={String(data?.totals.cancelada ?? 0)}
              delta={<Delta current={data?.totals.cancelada ?? 0} previous={data?.previousTotals?.cancelada ?? null} metricKey="cancelada" />}
            />
            <Tile icon={TrendingUp} label="Ventas" value={String(data?.totals.venta ?? 0)} delta={<Delta current={data?.totals.venta ?? 0} previous={data?.previousTotals?.venta ?? null} metricKey="venta" />} />
            <Tile icon={Percent} label="Conversión" value={`${conversion}%`} delta={<Delta current={conversion} previous={prevConversion} metricKey="conversion" />} />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Citas por Estado" />
        {!data || donutData.length === 0 ? (
          <EmptyState icon={PieChartIcon} title="Sin citas todavía" description="Todavía no hay citas sincronizadas para este período." />
        ) : (
          <>
            <div className="relative h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="count" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                    {donutData.map((d) => (
                      <Cell key={d.key} fill={ESTADO_DONUT_COLOR[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-semibold text-foreground">{data.totals.total}</span>
                <span className="text-xs text-neutral-500">Total</span>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {donutData.map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex items-center gap-2 text-neutral-500">
                    <span className="size-2 rounded-full" style={{ background: ESTADO_DONUT_COLOR[d.key] }} aria-hidden="true" />
                    {d.label}
                  </span>
                  <span className="font-mono text-foreground">
                    {d.count} ({Math.round((d.count / data.totals.total) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Citas por Tipo" />
        {!data || data.byType.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin tipo de cita cargado para este período.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.byType.map((t) => (
              <li key={t.type} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-foreground">{t.type}</span>
                  <span className="text-neutral-500">
                    {t.count} ({Math.round((t.count / data.totals.total) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-accent-500" style={{ width: `${maxTypeCount > 0 ? (t.count / maxTypeCount) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
