"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";

/** "Resumen de tareas" — Pendientes/En progreso/Completadas/Vencidas son
 * mutuamente excluyentes (una tarea vencida deja de contarse como
 * Pendiente/En progreso acá, ver page.tsx), suman el total real de tareas. */
export function TaskStatusDonutChart({
  pendientes,
  enProgreso,
  completadas,
  vencidas,
}: {
  pendientes: number;
  enProgreso: number;
  completadas: number;
  vencidas: number;
}) {
  const data = [
    { label: "Pendientes", value: pendientes, color: "var(--color-neutral-400)" },
    { label: "En progreso", value: enProgreso, color: "var(--color-info-strong)" },
    { label: "Completadas", value: completadas, color: "var(--color-success-strong)" },
    { label: "Vencidas", value: vencidas, color: "var(--color-error-strong)" },
  ];
  const total = pendientes + enProgreso + completadas + vencidas;
  const withData = data.filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader title="Resumen de tareas" />
      {total === 0 ? (
        <p className="text-sm text-neutral-500">Sin tareas todavía.</p>
      ) : (
        <>
          <div className="relative h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={withData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                  {withData.map((d) => (
                    <Cell key={d.label} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-xl font-semibold text-foreground">{total}</span>
              <span className="text-xs text-neutral-500">Total</span>
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {data.map((d) => (
              <li key={d.label} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-2 text-neutral-500">
                  <span className="size-2 rounded-full" style={{ background: d.color }} aria-hidden="true" />
                  {d.label}
                </span>
                <span className="font-mono text-foreground">
                  {d.value} {total > 0 ? `(${Math.round((d.value / total) * 100)}%)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
