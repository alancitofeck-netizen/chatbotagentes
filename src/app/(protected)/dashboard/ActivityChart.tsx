"use client";

import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ActivityPoint, ChartRange } from "@/lib/dashboard/queries";
import { getActivitySeriesAction } from "./actions";

const RANGES: { value: ChartRange; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
];

const SERIES = [
  { key: "mensajes" as const, label: "Mensajes", color: "var(--color-accent-500)" },
  { key: "leads" as const, label: "Leads", color: "var(--color-primary-500)" },
  { key: "reuniones" as const, label: "Reuniones", color: "var(--color-success)" },
  { key: "ventas" as const, label: "Ventas", color: "var(--color-warning)" },
];

export function ActivityChart({ initialData }: { initialData: ActivityPoint[] }) {
  const [range, setRange] = useState<ChartRange>("7d");
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  function handleRangeChange(next: string) {
    const nextRange = next as ChartRange;
    setRange(nextRange);
    startTransition(async () => {
      const series = await getActivitySeriesAction(nextRange);
      setData(series);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Actividad"
        action={
          <div role="group" aria-label="Rango de fechas" className="flex gap-1 rounded-full bg-surface-2 p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => handleRangeChange(r.value)}
                aria-pressed={range === r.value}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
                  range === r.value ? "bg-accent-500 text-white" : "text-neutral-500 hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className={`h-[280px] transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border-default)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
              minTickGap={24}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={32} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "var(--elevation-md)",
              }}
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
