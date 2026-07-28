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
    <div className="rounded-xl border border-border-default bg-surface-1 px-3.5 py-3 text-xs shadow-[var(--elevation-md)]">
      <p className="mb-1.5 font-mono font-semibold text-foreground">Año {label}</p>
      <p className="flex items-center gap-1.5 text-neutral-500">
        <span className="size-2 rounded-full bg-accent-500" /> Aportado <span className="ml-auto font-medium text-foreground">{formatCurrency(aportado)}</span>
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-neutral-500">
        <span className="size-2 rounded-full bg-success-strong" /> Interés <span className="ml-auto font-medium text-foreground">{formatCurrency(intereses)}</span>
      </p>
      <p className="mt-1.5 border-t border-border-default pt-1.5 font-medium text-foreground">Total {formatCurrency(aportado + intereses)}</p>
    </div>
  );
}

/** Paso 8's centerpiece chart — a stacked area (aportado + intereses) with a
 * total line on top, doubling as the "crecimiento del capital", "evolución
 * anual", and "aportes vs intereses" visuals the user asked for in one
 * interactive chart rather than three separate widgets. Categorical pair
 * (accent-500 / success-strong) validated against both the light and dark
 * chart surface via the dataviz skill's contrast/CVD checks. */
export function RetirementGrowthChart({ series }: { series: RetirementYearPoint[] }) {
  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-aportado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity={0.35} />
            </linearGradient>
            <linearGradient id="fill-intereses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success-strong)" stopOpacity={0.85} />
              <stop offset="100%" stopColor="var(--color-success-strong)" stopOpacity={0.35} />
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
          <Area type="monotone" dataKey="aportado" stackId="fondo" name="Aportado" stroke="var(--color-accent-500)" fill="url(#fill-aportado)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="intereses" stackId="fondo" name="Interés" stroke="var(--color-success-strong)" fill="url(#fill-intereses)" strokeWidth={1.5} />
          <Line type="monotone" dataKey="total" name="Total" stroke="var(--color-primary-700)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
