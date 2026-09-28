"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, ComposedChart, Line, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getMiniAppAnalyticsAction } from "@/lib/miniApps/actions";
import type { MiniAppAnalyticsData, MiniAppLeadRow } from "@/lib/miniApps/queries";

const RANGE_OPTIONS: { key: "today" | "week" | "month" | "year" | "custom"; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
  { key: "custom", label: "Rango personalizado" },
];

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatPct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 10) / 10}%`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Mapa de calor de leads por día de semana × franja horaria — se calcula acá
 * mismo a partir de `leads.fecha` (ya cargado por la página, sin consulta
 * propia), mismo criterio que el mapa de calor del dashboard de ManyChat
 * (dataviz por franjas de 2h) pero como grid de React en vez de HTML plano. */
function LeadsHeatmap({ leads }: { leads: MiniAppLeadRow[] }) {
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const l of leads) {
      const d = new Date(l.fecha);
      const wd = (d.getDay() + 6) % 7;
      g[wd][d.getHours()] += 1;
    }
    return g;
  }, [leads]);

  const max = Math.max(1, ...grid.flat());
  let peak = { v: -1, wd: 0, h: 0 };
  grid.forEach((row, wd) => row.forEach((v, h) => { if (v > peak.v) peak = { v, wd, h }; }));

  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[9px] text-neutral-400">
            {h % 3 === 0 ? h : ""}
          </div>
        ))}
        {grid.map((row, wd) => (
          <div key={wd} className="contents">
            <div className="flex items-center text-[10px] text-neutral-400">{WEEKDAY_LABELS[wd]}</div>
            {row.map((v, h) => {
              const pct = v ? Math.round(12 + (v / max) * 88) : 0;
              return (
                <div
                  key={h}
                  title={`${WEEKDAY_LABELS[wd]} ${h}:00 · ${v} lead${v === 1 ? "" : "s"}`}
                  className={`aspect-square rounded-[2px] ${peak.v > 0 && wd === peak.wd && h === peak.h ? "ring-1 ring-accent-500" : ""}`}
                  style={{ background: v ? `color-mix(in srgb, var(--color-accent-500) ${pct}%, var(--surface-2))` : "var(--surface-2)" }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {peak.v > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          Pico: <span className="font-medium text-foreground">{WEEKDAY_LABELS[peak.wd]} a las {peak.h}:00</span> ({peak.v} lead{peak.v === 1 ? "" : "s"})
        </p>
      )}
    </div>
  );
}

export function AnaliticasTab({ miniAppId, leads }: { miniAppId: string; leads: MiniAppLeadRow[] }) {
  const [preset, setPreset] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [comparePrevious, setComparePrevious] = useState(false);
  const [data, setData] = useState<MiniAppAnalyticsData | null>(null);

  useEffect(() => {
    if (preset === "custom" && (!customStart || !customEnd)) return;
    getMiniAppAnalyticsAction(miniAppId, preset, customStart || undefined, customEnd || undefined, comparePrevious).then(setData);
  }, [miniAppId, preset, customStart, customEnd, comparePrevious]);

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
        <label className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
          <input type="checkbox" checked={comparePrevious} onChange={(e) => setComparePrevious(e.target.checked)} className="size-3.5 rounded border-border-default" />
          Comparar con período anterior
        </label>
      </div>

      {!data ? (
        <p className="py-10 text-center text-sm text-neutral-500">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.hasStepTracking && (
              <Card className="flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Tasa de finalización</span>
                <span className="text-xl font-semibold text-foreground">{formatPct(data.rates.completionPct)}</span>
              </Card>
            )}
            <Card className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Visita → Lead</span>
              <span className="text-xl font-semibold text-foreground">{formatPct(data.rates.visitToLeadPct)}</span>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Lead → Cliente</span>
              <span className="text-xl font-semibold text-foreground">{formatPct(data.rates.leadToClientPct)}</span>
            </Card>
            {data.rates.avgDurationSeconds !== null && (
              <Card className="flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Tiempo promedio en la app</span>
                <span className="text-xl font-semibold text-foreground">{formatDuration(data.rates.avgDurationSeconds)}</span>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader title="Visitas y leads por día" />
            {data.series.every((p) => p.visits === 0 && p.leads === 0) ? (
              <p className="py-10 text-center text-sm text-neutral-500">Sin datos en este período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="leads" name="Leads" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="visits" name="Visitas" stroke="var(--color-primary-600)" strokeWidth={2} dot={false} />
                  {comparePrevious && (
                    <>
                      <Line type="monotone" dataKey="prevVisits" name="Visitas (período anterior)" stroke="var(--color-primary-600)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="prevLeads" name="Leads (período anterior)" stroke="var(--color-accent-500)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.hasStepTracking && data.abandonment.length > 1 && (
              <Card>
                <CardHeader title="¿En qué paso abandonan?" />
                <div className="flex flex-col gap-2.5">
                  {data.abandonment.map((step, i) => {
                    const prev = i > 0 ? data.abandonment[i - 1].count : step.count;
                    const dropPct = prev > 0 ? Math.round(((prev - step.count) / prev) * 100) : 0;
                    const max = data.abandonment[0].count || 1;
                    return (
                      <div key={step.step} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate text-xs text-neutral-600">{step.label}</span>
                        <div className="h-2.5 flex-1 rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.max(3, (step.count / max) * 100)}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs font-semibold text-foreground">{step.count}</span>
                        <span className="w-12 shrink-0 text-right text-[11px] text-neutral-400">{i > 0 && dropPct > 0 ? `−${dropPct}%` : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader title="Leads por día de semana y franja horaria" />
              <LeadsHeatmap leads={leads} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
