"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PieChart as PieChartIcon } from "lucide-react";
import type { LeadSource } from "@/lib/dashboard/queries";

const PALETTE = ["var(--color-accent-500)", "#F5A524", "#2E9563", "#3B82F6", "#EAB308"];

export function LeadsBySourceChart({ sources }: { sources: LeadSource[] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <CardHeader title="Leads por origen" />
      {sources.length === 0 ? (
        <EmptyState icon={PieChartIcon} title="Sin datos todavía" description="Los leads necesitan un origen." />
      ) : (
        <>
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sources}
                  dataKey="count"
                  nameKey="source"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {sources.map((s, i) => (
                    <Cell key={s.source} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "var(--elevation-md)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-semibold text-foreground">{total}</span>
              <span className="text-xs text-neutral-500">Total</span>
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {sources.slice(0, 5).map((s, i) => (
              <li key={s.source} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-2 text-neutral-500">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                    aria-hidden="true"
                  />
                  {s.source}
                </span>
                <span className="font-mono text-foreground">{s.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
