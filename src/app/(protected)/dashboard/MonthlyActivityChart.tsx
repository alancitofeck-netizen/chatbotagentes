"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import type { MonthlyActivityPoint } from "@/lib/dashboard/homeQueries";

export function MonthlyActivityChart({ data }: { data: MonthlyActivityPoint[] }) {
  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader title="Actividad mensual" action={<span className="text-xs font-medium text-neutral-400">{currentYear}</span>} />
      <p className="-mt-3 mb-3 text-xs text-neutral-500">Citas realizadas por mes</p>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="fill-citas-mensuales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-success-strong)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="var(--color-success-strong)" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border-default)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={28} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [`${value} cita${value === 1 ? "" : "s"}`, "Citas"]}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "var(--elevation-md)",
              }}
            />
            <Bar dataKey="count" name="Citas" fill="url(#fill-citas-mensuales)" radius={[6, 6, 6, 6]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
