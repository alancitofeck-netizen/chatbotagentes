"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import type { AgentMetrics } from "@/lib/ai-agents/queries";

const chartTooltipStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--elevation-md)",
};

export function MetricsTab({ metrics }: { metrics: AgentMetrics }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{metrics.conversationsHandled}</span>
          <p className="mt-1 text-[13px] text-neutral-500">Conversaciones atendidas (14 días)</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">
            {metrics.avgLatencyMs !== null ? `${(metrics.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
          </span>
          <p className="mt-1 text-[13px] text-neutral-500">Tiempo promedio de respuesta</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{(metrics.totalTokensIn + metrics.totalTokensOut).toLocaleString("es")}</span>
          <p className="mt-1 text-[13px] text-neutral-500">Tokens consumidos</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">${metrics.totalCostUsd.toFixed(2)}</span>
          <p className="mt-1 text-[13px] text-neutral-500">Costo estimado</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{metrics.humanHandoffs}</span>
          <p className="mt-1 text-[13px] text-neutral-500">Derivaciones a humano</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Actividad diaria (14 días)" />
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={metrics.daily}>
              <CartesianGrid vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} minTickGap={20} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={40} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar yAxisId="left" dataKey="messages" name="Turnos" fill="var(--color-accent-500)" radius={[4, 4, 4, 4]} maxBarSize={20} />
              <Line yAxisId="right" type="monotone" dataKey="costUsd" name="Costo (USD)" stroke="var(--color-success-strong)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
