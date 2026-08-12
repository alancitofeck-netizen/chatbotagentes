"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ClientAppointment } from "@/lib/clients/queries";

/** "Top campañas" — agrupa bookings.campana (texto libre cargado a mano
 * desde Agenda), sin catálogo fijo: cada asesor nombra sus campañas como
 * quiera (ej. "Abogados", "Empresarios"). */
export function CampaignBarChart({ appointments }: { appointments: ClientAppointment[] }) {
  const counts = new Map<string, number>();
  for (const a of appointments) {
    if (!a.campana) continue;
    counts.set(a.campana, (counts.get(a.campana) ?? 0) + 1);
  }
  const data = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <Card>
      <CardHeader title="Top campañas" />
      {data.length === 0 ? (
        <p className="text-sm text-neutral-500">Cargá la campaña de cada cita desde la tabla de arriba.</p>
      ) : (
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border-default)" />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={90} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <Tooltip
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }}
              />
              <Bar dataKey="count" name="Citas" fill="var(--color-accent-500)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
