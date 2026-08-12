"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FUENTE_LABEL } from "./appointmentMeta";
import type { ClientAppointment } from "@/lib/clients/queries";

const PALETTE = ["var(--color-accent-500)", "var(--color-chart-2)", "var(--color-chart-1)", "var(--color-chart-3)"];

/** Donut de "citas por fuente" — reusado por Agenda/Operación/KPIs (mismo
 * dato, mismo cálculo, distinto título/lugar). Solo cuenta citas que ya
 * tienen `fuente` cargada a mano (0127) — las que no, quedan afuera del
 * gráfico y se muestran aparte como "sin etiquetar", nunca agrupadas como
 * si fueran una fuente real. */
export function FuenteDonutChart({ title, appointments }: { title: string; appointments: ClientAppointment[] }) {
  const tagged = appointments.filter((a) => a.fuente !== null);
  const untagged = appointments.length - tagged.length;

  const counts = new Map<string, number>();
  for (const a of tagged) {
    const label = FUENTE_LABEL[a.fuente!];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const data = [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
  const total = tagged.length;

  return (
    <Card>
      <CardHeader title={title} />
      {data.length === 0 ? (
        <EmptyState icon={PieChartIcon} title="Sin datos todavía" description="Cargá la fuente de cada cita desde la tabla de Agenda." />
      ) : (
        <>
          <div className="relative h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="source" innerRadius={48} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                  {data.map((s, i) => (
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
              <span className="font-mono text-xl font-semibold text-foreground">{total}</span>
              <span className="text-xs text-neutral-500">Con fuente</span>
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {data.map((s, i) => (
              <li key={s.source} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-2 text-neutral-500">
                  <span className="size-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden="true" />
                  {s.source}
                </span>
                <span className="font-mono text-foreground">{s.count}</span>
              </li>
            ))}
          </ul>
          {untagged > 0 && <p className="mt-2 text-xs text-neutral-500">{untagged} cita{untagged === 1 ? "" : "s"} sin fuente cargada.</p>}
        </>
      )}
    </Card>
  );
}
