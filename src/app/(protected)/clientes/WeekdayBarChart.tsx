"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ClientAppointment } from "@/lib/clients/queries";

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** "Mejores días" — cuenta citas reales por día de semana (derivado de
 * startTime), no un calendario decorativo. Compartido Agenda/Operación. */
export function WeekdayBarChart({ appointments }: { appointments: ClientAppointment[] }) {
  const counts = new Array(7).fill(0);
  for (const a of appointments) counts[new Date(a.startTime).getDay()] += 1;
  const data = WEEKDAY_LABEL.map((label, i) => ({ label, count: counts[i] }));

  return (
    <Card>
      <CardHeader title="Mejores días" />
      {appointments.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin citas todavía.</p>
      ) : (
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={24} />
              <Tooltip
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }}
              />
              <Bar dataKey="count" name="Citas" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
