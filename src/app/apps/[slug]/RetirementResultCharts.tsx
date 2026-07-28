"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RetirementYearPoint } from "@/lib/miniApps/financialEngine";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: number }) {
  if (!active || !payload || payload.length === 0) return null;
  const aportado = payload.find((p) => p.dataKey === "aportado")?.value ?? 0;
  const intereses = payload.find((p) => p.dataKey === "intereses")?.value ?? 0;
  return (
    <div
      className="rounded-xl px-3.5 py-3 text-xs"
      style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-md)" }}
    >
      <p className="mb-1.5 font-mono font-semibold" style={{ color: "var(--ma-title-color)" }}>
        Año {label}
      </p>
      <p className="flex items-center gap-1.5" style={{ color: "var(--ma-text-muted)" }}>
        <span className="size-2 rounded-full" style={{ background: "var(--ma-chart-series-primary)" }} /> Aportado{" "}
        <span className="ml-auto font-medium" style={{ color: "var(--ma-text-color)" }}>
          {formatCurrency(aportado)}
        </span>
      </p>
      <p className="mt-1 flex items-center gap-1.5" style={{ color: "var(--ma-text-muted)" }}>
        <span className="size-2 rounded-full" style={{ background: "var(--ma-chart-series-secondary)" }} /> Interés{" "}
        <span className="ml-auto font-medium" style={{ color: "var(--ma-text-color)" }}>
          {formatCurrency(intereses)}
        </span>
      </p>
      <p className="mt-1.5 pt-1.5 font-medium" style={{ borderTop: "1px solid var(--ma-border)", color: "var(--ma-text-color)" }}>
        Total {formatCurrency(aportado + intereses)}
      </p>
    </div>
  );
}

/** Paso 8's centerpiece chart — a stacked area (aportado + intereses) with a
 * total line on top, doubling as the "crecimiento del capital", "evolución
 * anual", and "aportes vs intereses" visuals the user asked for in one
 * interactive chart rather than three separate widgets. Categorical pair
 * comes from paletteEngine.ts's chartSeriesPrimary/chartSeriesSecondary —
 * always contrast/hue-separated regardless of which two brand colors this
 * mini app picked (see generateMiniAppPalette's chartSecondary rotation).
 * Grid/axis neutrals stay on the sitewide --border-default/--color-neutral-*
 * tokens deliberately — structural chrome, not brand identity. */
export function RetirementGrowthChart({ series }: { series: RetirementYearPoint[] }) {
  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-aportado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ma-chart-series-primary)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--ma-chart-series-primary)" stopOpacity={0.35} />
            </linearGradient>
            <linearGradient id="fill-intereses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ma-chart-series-secondary)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--ma-chart-series-secondary)" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border-default)" />
          <XAxis
            dataKey="edad"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
            minTickGap={28}
            label={{ value: "Edad", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--color-neutral-400)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
            tickFormatter={(v: number) => formatCompact(v)}
            width={54}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="aportado" stackId="fondo" name="Aportado" stroke="var(--ma-chart-series-primary)" fill="url(#fill-aportado)" strokeWidth={1.5} />
          <Area
            type="monotone"
            dataKey="intereses"
            stackId="fondo"
            name="Interés"
            stroke="var(--ma-chart-series-secondary)"
            fill="url(#fill-intereses)"
            strokeWidth={1.5}
          />
          <Line type="monotone" dataKey="total" name="Total" stroke="var(--ma-button-primary-hover)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
