"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CrmBoard } from "@/lib/crm/queries";
import type { AgentListItem } from "@/lib/agents/queries";
import { deriveCrmAnalytics } from "@/lib/crm/analytics";
import { getCrmAnalyticsRangeAction } from "@/lib/crm/actions";
import type { CrmAnalyticsRangeData } from "@/lib/crm/analyticsRange";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function stageColor(isWon: boolean, isLost: boolean) {
  if (isWon) return "var(--color-success)";
  if (isLost) return "var(--color-error)";
  return "var(--color-accent-500)";
}

const RANGE_OPTIONS: { key: "today" | "week" | "month" | "year" | "custom"; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
  { key: "custom", label: "Rango personalizado" },
];

export function CrmAnalytics({ board, agents }: { board: CrmBoard; agents: AgentListItem[] }) {
  const analytics = deriveCrmAnalytics(board);
  const [preset, setPreset] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rangeData, setRangeData] = useState<CrmAnalyticsRangeData | null>(null);

  useEffect(() => {
    if (preset === "custom" && (!customStart || !customEnd)) return;
    getCrmAnalyticsRangeAction(preset, customStart || undefined, customEnd || undefined).then(setRangeData);
  }, [preset, customStart, customEnd]);

  const topAgents = [...agents].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setPreset(o.key)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
              preset === o.key ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-600 hover:bg-surface-3"
            }`}
          >
            {o.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input label="Desde" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} containerClassName="w-auto" />
            <span className="mt-5 text-sm text-neutral-500">a</span>
            <Input label="Hasta" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} containerClassName="w-auto" />
          </div>
        )}
      </div>

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
          <p className="mt-1.5 text-[13px] text-neutral-500">Tasa de conversión (histórica)</p>
        </Card>
        <Card>
          <p className="font-mono text-[28px] font-semibold leading-none text-foreground">
            {formatCurrency(analytics.avgDealSize)}
          </p>
          <p className="mt-1.5 text-[13px] text-neutral-500">Deal promedio</p>
        </Card>
      </div>

      {!rangeData ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-foreground">{rangeData.newContacts}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Nuevos contactos (período)</p>
          </Card>
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-foreground">{rangeData.conversations}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Conversaciones (período)</p>
          </Card>
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-foreground">{rangeData.meetingsScheduled}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Reuniones agendadas (período)</p>
          </Card>
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-foreground">{rangeData.activeClients}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Clientes activos (período)</p>
          </Card>
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-success-strong">{rangeData.oppsWon}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Oportunidades ganadas (período)</p>
          </Card>
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-error-strong">{rangeData.oppsLost}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Oportunidades perdidas (período)</p>
          </Card>
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-foreground">
              {rangeData.avgResponseMinutes !== null ? `${rangeData.avgResponseMinutes} min` : "—"}
            </p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Tiempo promedio de respuesta</p>
          </Card>
          <Card>
            <p className="font-mono text-[24px] font-semibold leading-none text-foreground">{analytics.wonCount + analytics.lostCount}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">Total cerradas (histórico)</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Embudo de conversión" />
          <div className="h-[280px]">
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

        <Card>
          <CardHeader title="Nuevos contactos por día (período)" />
          <div className="h-[280px]">
            {!rangeData ? (
              <Skeleton className="h-full w-full" />
            ) : rangeData.leadsSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">Sin datos en este período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rangeData.leadsSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border-default)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "var(--elevation-md)",
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="var(--color-accent-500)" fill="var(--color-accent-100)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Rendimiento por agente" />
        {topAgents.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin agentes todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {topAgents.map((a) => (
              <li key={a.memberId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">{a.fullName}</span>
                <span className="shrink-0 text-neutral-500">
                  Score {a.score} · {a.responseRate}% respuesta · {a.conversionRate}% conversión
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
