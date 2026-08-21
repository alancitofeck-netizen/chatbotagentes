"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import { Sheet } from "@/components/ui/Sheet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { AgencyKpiEntryRow } from "@/lib/kpis/agencyPerformance";
import { totalsFromEntries, acceptanceRate, responseRate, conversationRate, bookingRate, conversionRate, agendas, type KpiTotals } from "@/lib/kpis/formulas";
import { deltaPct } from "@/lib/clients/statsHelpers";
import { RENDIMIENTO_LABEL, type RendimientoStatus } from "@/lib/kpis/aiManager/analysis";
import { monthLabel } from "@/lib/kpis/periodHelpers";

type RangeOption = "4w" | "8w" | "3m" | "6m";

const RANGE_LABEL: Record<RangeOption, string> = { "4w": "Últimas 4 semanas", "8w": "Últimas 8 semanas", "3m": "Últimos 3 meses", "6m": "Últimos 6 meses" };

const METRICS: { key: keyof KpiTotals | "conversion"; label: string; color: string }[] = [
  { key: "conexion", label: "Conexiones", color: "var(--color-accent-500)" },
  { key: "calificadas", label: "Calificadas", color: "var(--color-success-strong)" },
];

function sortKey(e: AgencyKpiEntryRow): string {
  return `${e.periodMonth}-${String(e.weekNumber).padStart(2, "0")}`;
}

export function SetterDetailSheet({
  setterName,
  advisorName,
  entries,
  currentTotals,
  previousTotals,
  status,
  onClose,
}: {
  setterName: string;
  advisorName: string;
  entries: AgencyKpiEntryRow[];
  currentTotals: KpiTotals;
  previousTotals: KpiTotals;
  status: RendimientoStatus;
  onClose: () => void;
}) {
  const [range, setRange] = useState<RangeOption>("8w");

  const chartData = useMemo(() => {
    if (range === "4w" || range === "8w") {
      const n = range === "4w" ? 4 : 8;
      const sorted = [...entries].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      return sorted.slice(-n).map((e) => ({
        label: `S${e.weekNumber} ${monthLabel(e.periodMonth).slice(0, 3)}`,
        conexion: e.conexion,
        calificadas: e.calificadas,
      }));
    }
    const n = range === "3m" ? 3 : 6;
    const byMonth = new Map<string, AgencyKpiEntryRow[]>();
    for (const e of entries) byMonth.set(e.periodMonth, [...(byMonth.get(e.periodMonth) ?? []), e]);
    const months = [...byMonth.keys()].sort().slice(-n);
    return months.map((m) => {
      const totals = totalsFromEntries(byMonth.get(m) ?? []);
      return { label: monthLabel(m).slice(0, 3), conexion: totals.conexion, calificadas: totals.calificadas };
    });
  }, [entries, range]);

  const summaryRows: { label: string; current: number; previous: number; suffix?: string }[] = [
    { label: "Conexiones", current: currentTotals.conexion, previous: previousTotals.conexion },
    { label: "Aceptadas", current: currentTotals.conexionesAceptadas, previous: previousTotals.conexionesAceptadas },
    { label: "Respuestas", current: currentTotals.respuestasPrimerMensaje, previous: previousTotals.respuestasPrimerMensaje },
    { label: "Agendas", current: agendas(currentTotals), previous: agendas(previousTotals) },
    { label: "Calificadas", current: currentTotals.calificadas, previous: previousTotals.calificadas },
  ];

  const rateRows = [
    { label: "Acceptance Rate", current: acceptanceRate(currentTotals) },
    { label: "Response Rate", current: responseRate(currentTotals) },
    { label: "Conversation Rate", current: conversationRate(currentTotals) },
    { label: "Booking Rate", current: bookingRate(currentTotals) },
    { label: "Calif. Rate", current: conversionRate(currentTotals) },
  ];

  return (
    <Sheet open onClose={onClose} title={setterName} className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">Asesor: {advisorName}</p>
          <Badge variant={status === "bueno" ? "success" : status === "atencion" ? "warning" : "error"} dot>
            {RENDIMIENTO_LABEL[status]}
          </Badge>
        </div>

        <Card>
          <CardHeader title="Resumen del período" />
          <table className="w-full text-sm">
            <tbody>
              {summaryRows.map((r) => {
                const pct = deltaPct(r.current, r.previous);
                return (
                  <tr key={r.label} className="border-b border-border-default/60 last:border-0">
                    <td className="py-1.5 text-neutral-500">{r.label}</td>
                    <td className="py-1.5 text-right font-medium text-foreground">{r.current}</td>
                    <td className={`w-20 py-1.5 text-right text-xs ${pct === null ? "text-neutral-400" : pct >= 0 ? "text-success-strong" : "text-error-strong"}`}>
                      {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Tasas del período" />
          <table className="w-full text-sm">
            <tbody>
              {rateRows.map((r) => (
                <tr key={r.label} className="border-b border-border-default/60 last:border-0">
                  <td className="py-1.5 text-neutral-500">{r.label}</td>
                  <td className="py-1.5 text-right font-medium text-foreground">{r.current}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader
            title="Evolución"
            action={
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangeOption)}
                className="rounded-sm border border-border-strong bg-surface-1 px-2 py-1 text-xs text-foreground outline-none"
              >
                {(Object.keys(RANGE_LABEL) as RangeOption[]).map((r) => (
                  <option key={r} value={r}>
                    {RANGE_LABEL[r]}
                  </option>
                ))}
              </select>
            }
          />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={28} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {METRICS.map((m) => (
                  <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </Sheet>
  );
}
