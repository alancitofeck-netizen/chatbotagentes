"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPolicyCommissionAnalyticsAction } from "@/lib/policies/actions";
import type { PolicyCommissionAnalytics } from "@/lib/policies/queries";
import { formatCurrency } from "@/lib/utils/format";

const CHART_TOOLTIP_STYLE = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--elevation-md)",
};

/** Analítica de comisiones — todo derivado de policies.commission_amount/
 * commission_status (getPolicyCommissionAnalytics), sin tabla nueva. Mismo
 * estilo visual que CrmAnalytics.tsx (recharts + tokens de diseño del CRM,
 * como pidió el usuario para todo el módulo Pólizas). */
export function PolicyCommissionsView() {
  const [data, setData] = useState<PolicyCommissionAnalytics | null>(null);

  useEffect(() => {
    getPolicyCommissionAnalyticsAction().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-foreground">{formatCurrency(data.totalCommission)}</p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Comisión total</p>
        </Card>
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-success-strong">{formatCurrency(data.collectedCommission)}</p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Cobrada</p>
        </Card>
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-warning-strong">{formatCurrency(data.pendingCommission)}</p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Pendiente</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Comisión por mes (últimos 12 meses)" />
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.byMonth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={48} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
              <Area type="monotone" dataKey="amount" stroke="var(--color-accent-500)" fill="var(--color-accent-100)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Comisión por aseguradora" />
          {data.byCompany.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin comisiones cargadas.</p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCompany} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border-default)" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
                  <YAxis dataKey="company" type="category" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="amount" fill="var(--color-accent-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Comisión por asesor" />
          {data.byOwner.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin comisiones cargadas.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {data.byOwner.map((o) => (
                <li key={o.ownerName} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-foreground">{o.ownerName}</span>
                  <span className="shrink-0 font-mono text-neutral-500">{formatCurrency(o.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
