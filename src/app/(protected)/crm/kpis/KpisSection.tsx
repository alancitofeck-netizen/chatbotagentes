"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Table2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { Team } from "@/lib/agents/queries";
import { getKpiEntriesAction, getKpiSetterOptionsAction, getKpiGoalsAction, setKpiGoalAction } from "@/lib/kpis/actions";
import type { KpiEntryRow, KpiSetterOption } from "@/lib/kpis/queries";
import { agendas, conversionRate, estadoLevel, ESTADO_LABEL, sumKpiTotals, EMPTY_KPI_TOTALS, type KpiTotals } from "@/lib/kpis/formulas";
import { createClient } from "@/lib/supabase/client";

const CARD_DEFS: { key: keyof KpiTotals; label: string }[] = [
  { key: "conexion", label: "Conexión" },
  { key: "conexionesAceptadas", label: "Conexiones aceptadas" },
  { key: "respuestasPrimerMensaje", label: "Respuestas al primer mensaje" },
  { key: "primerMensajeEnviado", label: "Primer mensaje enviado" },
  { key: "enConversacion", label: "En conversación" },
  { key: "noLeInteresa", label: "No le interesa" },
  { key: "seguimientoConversacion", label: "Seguimiento conversación" },
  { key: "seguimientoAgenda", label: "Seguimiento agenda" },
  { key: "agendaManual", label: "Agenda manual" },
  { key: "calificadas", label: "Calificadas" },
];

const GOAL_METRICS: { key: string; label: string; pick: (t: KpiTotals) => number }[] = [
  { key: "conexion", label: "Conexión", pick: (t) => t.conexion },
  { key: "agendas", label: "Agendas", pick: (t) => agendas(t) },
  { key: "calificadas", label: "Calificadas", pick: (t) => t.calificadas },
];

function currentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function KpisSection({ hasConnection, teams }: { hasConnection: boolean; teams: Team[] }) {
  const [periodMonth, setPeriodMonth] = useState(currentMonthIso());
  const [tab, setTab] = useState<"1" | "2" | "3" | "4" | "monthly">("monthly");
  const [setterId, setSetterId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [entries, setEntries] = useState<KpiEntryRow[] | null>(null);
  const [setters, setSetters] = useState<KpiSetterOption[]>([]);
  const [goals, setGoals] = useState<{ metricKey: string; targetValue: number }[]>([]);
  const [isPending, startTransition] = useTransition();
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!hasConnection) return;
    getKpiSetterOptionsAction().then(setSetters);
  }, [hasConnection]);

  useEffect(() => {
    if (!hasConnection) return;
    startTransition(async () => {
      const [rows, goalRows] = await Promise.all([
        getKpiEntriesAction({
          periodMonth,
          weekNumber: tab === "monthly" ? undefined : Number(tab),
          setterId: setterId || undefined,
          teamId: teamId || undefined,
        }),
        getKpiGoalsAction(periodMonth),
      ]);
      setEntries(rows);
      setGoals(goalRows);
    });
  }, [hasConnection, periodMonth, tab, setterId, teamId]);

  // Real-time: any change to this workspace's kpi_entries refetches the
  // current view without a page reload. Must getSession()+setAuth() BEFORE
  // subscribing or RLS silently drops every event (same gotcha already hit
  // in Inbox/Contactos this project).
  useEffect(() => {
    if (!hasConnection) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel("kpi-entries")
        .on("postgres_changes", { event: "*", schema: "public", table: "kpi_entries" }, () => {
          getKpiEntriesAction({
            periodMonth,
            weekNumber: tab === "monthly" ? undefined : Number(tab),
            setterId: setterId || undefined,
            teamId: teamId || undefined,
          }).then(setEntries);
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [hasConnection, periodMonth, tab, setterId, teamId]);

  const totals = useMemo(() => (entries ? sumKpiTotals(entries) : EMPTY_KPI_TOTALS), [entries]);
  const conversion = conversionRate(totals);

  const weeklySeries = useMemo(() => {
    if (!entries) return [];
    const byWeek = new Map<number, KpiTotals[]>();
    for (const e of entries) {
      const list = byWeek.get(e.weekNumber) ?? [];
      list.push(e);
      byWeek.set(e.weekNumber, list);
    }
    return [1, 2, 3, 4].map((w) => {
      const t = sumKpiTotals(byWeek.get(w) ?? []);
      return { week: `S${w}`, conexion: t.conexion, agendas: agendas(t), calificadas: t.calificadas };
    });
  }, [entries]);

  const ranking = useMemo(() => {
    if (!entries) return [];
    const bySetter = new Map<string, { setterName: string; rows: KpiTotals[] }>();
    for (const e of entries) {
      const bucket = bySetter.get(e.setterId) ?? { setterName: e.setterName, rows: [] };
      bucket.rows.push(e);
      bySetter.set(e.setterId, bucket);
    }
    return [...bySetter.entries()]
      .map(([id, { setterName, rows }]) => {
        const t = sumKpiTotals(rows);
        const conv = conversionRate(t);
        return { setterId: id, setterName, conexion: t.conexion, agendas: agendas(t), calificadas: t.calificadas, conversion: conv, estado: estadoLevel(conv) };
      })
      .sort((a, b) => b.conversion - a.conversion);
  }, [entries]);

  function handleSaveGoal(metricKey: string) {
    const raw = goalDrafts[metricKey];
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0) {
      toast.error("Ingresá un número válido.");
      return;
    }
    startTransition(async () => {
      try {
        await setKpiGoalAction(periodMonth, metricKey, value);
        setGoals((prev) => [...prev.filter((g) => g.metricKey !== metricKey), { metricKey, targetValue: value }]);
        toast.success("Meta guardada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la meta.");
      }
    });
  }

  if (!hasConnection) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState
          icon={Table2}
          title="Conectá tu hoja de KPIs"
          description="Conectá Google Sheets en Configuración → Integraciones para ver los números de tus setters acá, sin abrir la hoja."
          action={
            <Button onClick={() => (window.location.href = "/profile?tab=integrations")} size="sm">
              Ir a Integraciones
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Mes"
          type="month"
          value={periodMonth.slice(0, 7)}
          onChange={(e) => setPeriodMonth(`${e.target.value}-01`)}
          containerClassName="w-auto"
        />
        <Select label="Setter" value={setterId} onChange={(e) => setSetterId(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {setters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </Select>
        <Select label="Equipo" value={teamId} onChange={(e) => setTeamId(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {!entries ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          {CARD_DEFS.map((c) => (
            <Card key={c.key}>
              <p className="font-mono text-[22px] font-semibold leading-none text-foreground">{totals[c.key]}</p>
              <p className="mt-1.5 text-[13px] text-neutral-500">{c.label}</p>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="1">Semana 1</TabsTrigger>
          <TabsTrigger value="2">Semana 2</TabsTrigger>
          <TabsTrigger value="3">Semana 3</TabsTrigger>
          <TabsTrigger value="4">Semana 4</TabsTrigger>
          <TabsTrigger value="monthly">Mensual</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(
          [
            { key: "conexion" as const, label: "Conexión por semana" },
            { key: "agendas" as const, label: "Agendas por semana" },
            { key: "calificadas" as const, label: "Calificadas por semana" },
          ]
        ).map((chart) => (
          <Card key={chart.key}>
            <CardHeader title={chart.label} />
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border-default)" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "var(--elevation-md)",
                    }}
                  />
                  <Bar dataKey={chart.key} fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Conversión" />
        <p className="font-mono text-[28px] font-semibold leading-none text-foreground">{conversion}%</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">Calificadas / Conexiones aceptadas</p>
      </Card>

      <Card>
        <CardHeader title="Ranking de setters" />
        {ranking.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin datos para este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Setter</th>
                  <th className="py-2 pr-3 font-medium">Conexión</th>
                  <th className="py-2 pr-3 font-medium">Agendas</th>
                  <th className="py-2 pr-3 font-medium">Calificadas</th>
                  <th className="py-2 pr-3 font-medium">Conversión</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.setterId} className="border-b border-border-default last:border-0">
                    <td className="py-2 pr-3 font-medium text-foreground">{r.setterName}</td>
                    <td className="py-2 pr-3 text-neutral-600">{r.conexion}</td>
                    <td className="py-2 pr-3 text-neutral-600">{r.agendas}</td>
                    <td className="py-2 pr-3 text-neutral-600">{r.calificadas}</td>
                    <td className="py-2 pr-3 text-neutral-600">{r.conversion}%</td>
                    <td className="py-2 pr-3">{ESTADO_LABEL[r.estado]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={`Objetivos — ${monthLabel(periodMonth)}`} />
        <div className="flex flex-col gap-4">
          {GOAL_METRICS.map((m) => {
            const goal = goals.find((g) => g.metricKey === m.key);
            const actual = m.pick(totals);
            const target = goal?.targetValue ?? 0;
            const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
            return (
              <div key={m.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{m.label}</span>
                  <span className="text-neutral-500">
                    {actual} / {target || "—"} {target > 0 && `· ${pct}%`}
                  </span>
                </div>
                <ProgressBar value={target > 0 ? pct : 0} />
                <div className="flex items-center gap-2">
                  <Input
                    label="Meta"
                    type="number"
                    placeholder="Meta mensual"
                    value={goalDrafts[m.key] ?? ""}
                    onChange={(e) => setGoalDrafts((prev) => ({ ...prev, [m.key]: e.target.value }))}
                    containerClassName="w-32"
                  />
                  <Button size="sm" variant="secondary" onClick={() => handleSaveGoal(m.key)} loading={isPending}>
                    Guardar meta
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
