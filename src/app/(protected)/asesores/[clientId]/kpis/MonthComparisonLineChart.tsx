"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";

/** "Citas generadas": este mes vs. mes anterior, día por día — mismo dato
 * que los tiles (bookings.start_time real), overlay de dos series. */
export function MonthComparisonLineChart({ thisMonthDates, lastMonthDates }: { thisMonthDates: string[]; lastMonthDates: string[] }) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const actual = new Array(daysInMonth).fill(0);
  for (const d of thisMonthDates) actual[new Date(d).getDate() - 1] += 1;

  const anterior = new Array(daysInMonth).fill(0);
  for (const d of lastMonthDates) {
    const day = new Date(d).getDate();
    if (day <= daysInMonth) anterior[day - 1] += 1;
  }

  const data = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, actual: actual[i], anterior: anterior[i] }));
  const hasData = thisMonthDates.length > 0 || lastMonthDates.length > 0;

  return (
    <Card>
      <CardHeader title="Citas generadas — este mes vs. anterior" />
      {!hasData ? (
        <p className="text-sm text-neutral-500">Sin citas todavía.</p>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={28} />
              <Tooltip
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="actual" name="Este mes" stroke="var(--color-accent-500)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="anterior" name="Mes anterior" stroke="var(--color-neutral-400)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
