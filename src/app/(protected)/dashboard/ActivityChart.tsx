"use client";

import { useState, useTransition } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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
        title="Revenue Analytics"
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
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="fill-ventas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="var(--color-accent-300)" stopOpacity={0.5} />
              </linearGradient>
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
            <Bar dataKey="ventas" name="Ventas" fill="url(#fill-ventas)" radius={[6, 6, 6, 6]} maxBarSize={28} />
            <Line
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke="var(--color-primary-500)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-4">
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="size-2 rounded-full" style={{ background: "var(--color-accent-500)" }} />
          Ventas
        </span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="size-2 rounded-full" style={{ background: "var(--color-primary-500)" }} />
          Leads
        </span>
      </div>
    </Card>
  );
}
