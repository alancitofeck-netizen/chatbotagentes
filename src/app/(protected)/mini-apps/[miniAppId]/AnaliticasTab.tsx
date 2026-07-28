"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getMiniAppLeadsByDayAction } from "@/lib/miniApps/actions";

const RANGE_OPTIONS: { key: "today" | "week" | "month" | "year" | "custom"; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
  { key: "custom", label: "Rango personalizado" },
];

export function AnaliticasTab({ miniAppId }: { miniAppId: string }) {
  const [preset, setPreset] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    if (preset === "custom" && (!customStart || !customEnd)) return;
    getMiniAppLeadsByDayAction(miniAppId, preset, customStart || undefined, customEnd || undefined).then(setData);
  }, [miniAppId, preset, customStart, customEnd]);

  return (
    <div className="flex flex-col gap-4">
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

      <Card>
        <p className="mb-4 text-[13px] font-medium text-neutral-500">Leads por día</p>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">Sin datos en este período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
