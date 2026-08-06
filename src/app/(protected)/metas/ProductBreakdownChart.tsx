"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getProductBreakdownAction } from "@/lib/goals/actions";
import type { ProductBreakdownEntry } from "@/lib/goals/queries";
import { formatCurrency } from "@/lib/utils/format";

const CHART_TOOLTIP_STYLE = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--elevation-md)",
};

const INSURANCE_TYPE_LABEL: Record<string, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };

/** "Progreso por producto" del spec — ramos reales del CRM (auto/hogar/
 * vida/otro), no categorías inventadas. Mismo estilo que
 * PolicyCommissionsView.tsx (recharts + tokens de diseño). */
export function ProductBreakdownChart({ periodStart, periodEnd, scope }: { periodStart: string; periodEnd: string; scope: "own" | "team" }) {
  const [data, setData] = useState<ProductBreakdownEntry[] | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setData(null));
    getProductBreakdownAction({ periodStart, periodEnd, scope }).then(setData);
  }, [periodStart, periodEnd, scope]);

  return (
    <Card>
      <CardHeader title="Progreso por ramo" />
      {!data ? (
        <Skeleton className="h-[220px] w-full" />
      ) : data.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pólizas emitidas en este período.</p>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.map((d) => ({ ...d, label: INSURANCE_TYPE_LABEL[d.insuranceType] ?? d.insuranceType }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={48} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value, name) => (name === "premium" ? formatCurrency(Number(value)) : value)} />
              <Bar dataKey="premium" name="premium" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
