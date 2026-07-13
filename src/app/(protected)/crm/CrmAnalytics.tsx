"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import type { CrmBoard } from "@/lib/crm/queries";
import { deriveCrmAnalytics } from "@/lib/crm/analytics";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function stageColor(isWon: boolean, isLost: boolean) {
  if (isWon) return "var(--color-success)";
  if (isLost) return "var(--color-error)";
  return "var(--color-accent-500)";
}

export function CrmAnalytics({ board }: { board: CrmBoard }) {
  const analytics = deriveCrmAnalytics(board);

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-foreground">
            {formatCurrency(analytics.openPipelineValue)}
          </p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Pipeline abierto</p>
        </Card>
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-foreground">
            {formatCurrency(analytics.wonValue)}
          </p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Ganado ({analytics.wonCount})</p>
        </Card>
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-foreground">
            {analytics.conversionRate}%
          </p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Tasa de conversión</p>
        </Card>
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-foreground">
            {formatCurrency(analytics.avgDealSize)}
          </p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Deal promedio</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Embudo de conversión" />
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.funnel} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-default)" />
              <XAxis
                dataKey="stageName"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "var(--elevation-md)",
                }}
                formatter={(value, name, item) => {
                  const stage = item.payload as (typeof analytics.funnel)[number];
                  return [`${value} · ${formatCurrency(stage.value)}`, "Oportunidades"];
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {analytics.funnel.map((stage) => (
                  <Cell key={stage.stageId} fill={stageColor(stage.isWon, stage.isLost)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
