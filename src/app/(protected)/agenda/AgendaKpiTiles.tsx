"use client";

import { CalendarCheck2, CheckCircle2, XCircle, Ban, DollarSign, Percent, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { AgendaPerformance } from "@/lib/agenda/queries";
import { AGENDA_ANALYTICS_PRESETS, type AgendaAnalyticsPreset } from "./useAgendaPerformance";

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

const TILE_COLOR = {
  violet: "bg-accent-500/15 text-accent-600",
  success: "bg-success-bg text-success-strong",
  error: "bg-error-bg text-error-strong",
  warning: "bg-warning-bg text-warning-strong",
} as const;

function Tile({ icon: Icon, color, label, value, delta }: { icon: React.ElementType; color: keyof typeof TILE_COLOR; label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-3.5">
      <div className="flex items-center gap-2">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TILE_COLOR[color]}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <p className="text-[12px] text-neutral-500">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {delta}
    </div>
  );
}

/** "KPIs Automáticos" — 6 tiles, un color distinto por métrica (mismo
 * criterio que las badges de estado: identidad visual, no decoración),
 * derivados de getAgendaPerformanceAction. */
export function AgendaKpiTiles({
  data,
  preset,
  onPresetChange,
  loading,
}: {
  data: AgendaPerformance | null;
  preset: AgendaAnalyticsPreset;
  onPresetChange: (preset: AgendaAnalyticsPreset) => void;
  loading: boolean;
}) {
  const conversion = data && data.totals.total > 0 ? Math.round((data.totals.venta / data.totals.total) * 100) : 0;
  const prevConversion = data?.previousTotals && data.previousTotals.total > 0 ? Math.round((data.previousTotals.venta / data.previousTotals.total) * 100) : null;

  return (
    <Card>
      <CardHeader
        title="KPIs Automáticos"
        action={
          <Select label="" value={preset} onChange={(e) => onPresetChange(e.target.value as AgendaAnalyticsPreset)} containerClassName="w-auto">
            {AGENDA_ANALYTICS_PRESETS.map((p) => (
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
          <Tile
            icon={CalendarCheck2}
            color="violet"
            label="Citas Recibidas"
            value={String(data?.totals.total ?? 0)}
            delta={<Delta current={data?.totals.total ?? 0} previous={data?.previousTotals?.total ?? null} metricKey="total" />}
          />
          <Tile
            icon={CheckCircle2}
            color="success"
            label="Citas Realizadas"
            value={String(data?.totals.realizada ?? 0)}
            delta={<Delta current={data?.totals.realizada ?? 0} previous={data?.previousTotals?.realizada ?? null} metricKey="realizada" />}
          />
          <Tile
            icon={XCircle}
            color="error"
            label="No Shows"
            value={String(data?.totals.no_show ?? 0)}
            delta={<Delta current={data?.totals.no_show ?? 0} previous={data?.previousTotals?.no_show ?? null} metricKey="no_show" />}
          />
          <Tile
            icon={Ban}
            color="warning"
            label="Canceladas"
            value={String(data?.totals.cancelada ?? 0)}
            delta={<Delta current={data?.totals.cancelada ?? 0} previous={data?.previousTotals?.cancelada ?? null} metricKey="cancelada" />}
          />
          <Tile
            icon={DollarSign}
            color="success"
            label="Ventas"
            value={String(data?.totals.venta ?? 0)}
            delta={<Delta current={data?.totals.venta ?? 0} previous={data?.previousTotals?.venta ?? null} metricKey="venta" />}
          />
          <Tile icon={Percent} color="violet" label="Conversión" value={`${conversion}%`} delta={<Delta current={conversion} previous={prevConversion} metricKey="conversion" />} />
        </div>
      )}
    </Card>
  );
}
