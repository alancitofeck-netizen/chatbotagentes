"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AgendaPerformance } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";

const ESTADO_DONUT_COLOR: Record<(typeof ESTADO_CITA_OPTIONS)[number], string> = {
  agendada: "var(--color-warning)",
  confirmada: "var(--color-info)",
  realizada: "var(--color-success)",
  no_show: "var(--color-error)",
  cancelada: "var(--color-neutral-400)",
  venta: "var(--color-accent-500)",
};

/** "Citas por Estado" — colores de estado, mismos que las badges de
 * CitaCard/AgendaAppointmentsTable (identidad consistente en toda la
 * pantalla). Leyenda al costado del donut, no debajo. */
export function AgendaEstadoDonut({ data }: { data: AgendaPerformance | null }) {
  const donutData = data ? ESTADO_CITA_OPTIONS.map((e) => ({ key: e, label: ESTADO_CITA_META[e].label, count: data.totals[e] })).filter((d) => d.count > 0) : [];

  return (
    <Card>
      <CardHeader title="Citas por Estado" />
      {!data || donutData.length === 0 ? (
        <EmptyState icon={PieChartIcon} title="Sin citas todavía" description="Todavía no hay citas sincronizadas para este período." />
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative size-[132px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="count" nameKey="label" innerRadius={40} outerRadius={62} paddingAngle={2} strokeWidth={0}>
                  {donutData.map((d) => (
                    <Cell key={d.key} fill={ESTADO_DONUT_COLOR[d.key]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-xl font-semibold text-foreground">{data.totals.total}</span>
              <span className="text-[10px] text-neutral-500">Total</span>
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-1.5">
            {donutData.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-2 text-neutral-500">
                  <span className="size-2 rounded-full" style={{ background: ESTADO_DONUT_COLOR[d.key] }} aria-hidden="true" />
                  {d.label}
                </span>
                <span className="font-mono text-foreground">
                  {d.count} ({Math.round((d.count / data.totals.total) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
