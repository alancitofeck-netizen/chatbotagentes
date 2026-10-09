"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  MessageCircle,
  MessageSquarePlus,
  MessagesSquare,
  RefreshCw,
  Send,
  Table2,
  ThumbsDown,
  Users,
  type LucideIcon,
} from "lucide-react";
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
import { getKpiEntriesAction, getKpiSetterOptionsAction, getKpiGoalsAction, getKpiSetterSheetsAction, setKpiGoalAction, syncKpisNowAction } from "@/lib/kpis/actions";
import type { KpiEntryRow, KpiSetterOption, KpiSetterSheetInfo } from "@/lib/kpis/queries";
import { agendas, conversionRate, estadoLevel, ESTADO_LABEL, sumKpiTotals, EMPTY_KPI_TOTALS, type KpiTotals } from "@/lib/kpis/formulas";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

type CardTone = "accent" | "info" | "warning" | "success" | "neutral";

const CARD_TONE: Record<CardTone, string> = {
  accent: "bg-accent-500/15 text-accent-500",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  neutral: "bg-neutral-400/15 text-neutral-500",
};

interface CardDef {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: CardTone;
  pick: (t: KpiTotals) => number;
}

/** Embudo, en el orden real de la hoja: cada tarjeta muestra su % sobre el paso
 * anterior. "Agendas" = Seguimiento agenda + Agenda manual (formulas.ts). */
const FUNNEL: CardDef[] = [
  { key: "conexion", label: "Conexiones enviadas", icon: Send, tone: "accent", pick: (t) => t.conexion },
  { key: "conexionesAceptadas", label: "Aceptadas", icon: Check, tone: "accent", pick: (t) => t.conexionesAceptadas },
  { key: "primerMensajeEnviado", label: "Primer mensaje", icon: MessageSquarePlus, tone: "info", pick: (t) => t.primerMensajeEnviado },
  { key: "respuestasPrimerMensaje", label: "Respuestas", icon: MessageCircle, tone: "info", pick: (t) => t.respuestasPrimerMensaje },
  { key: "enConversacion", label: "Conversaciones", icon: Users, tone: "info", pick: (t) => t.enConversacion },
  { key: "agendas", label: "Agendas", icon: CalendarCheck, tone: "warning", pick: (t) => agendas(t) },
  { key: "calificadas", label: "Calificadas", icon: BadgeCheck, tone: "success", pick: (t) => t.calificadas },
];

/** Resto de las columnas de la hoja: no son pasos del embudo, van sin %. */
const DETAIL: CardDef[] = [
  { key: "noLeInteresa", label: "No le interesa", icon: ThumbsDown, tone: "neutral", pick: (t) => t.noLeInteresa },
  { key: "seguimientoConversacion", label: "Seguimiento conversación", icon: MessagesSquare, tone: "neutral", pick: (t) => t.seguimientoConversacion },
  { key: "seguimientoAgenda", label: "Seguimiento agenda", icon: CalendarClock, tone: "neutral", pick: (t) => t.seguimientoAgenda },
  { key: "agendaManual", label: "Agenda manual", icon: CalendarPlus, tone: "neutral", pick: (t) => t.agendaManual },
];

const numberFormat = new Intl.NumberFormat("es-AR");

function KpiCard({ def, value, caption, tourId }: { def: CardDef; value: number; caption?: string; tourId?: string }) {
  const Icon = def.icon;
  return (
    <div data-tour={tourId} className="rounded-2xl border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-sm)]">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", CARD_TONE[def.tone])}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <p className="min-w-0 text-[13px] leading-tight text-foreground/80">{def.label}</p>
      </div>
      <p className="mt-2.5 font-display text-[24px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-foreground">{numberFormat.format(value)}</p>
      {caption && <p className="mt-1.5 text-xs font-semibold text-neutral-500">{caption}</p>}
    </div>
  );
}

/** Los últimos 12 meses (el actual primero), como opciones del selector "Mes". */
function recentMonths(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1)).toISOString().slice(0, 10));
}

/** "octubre de 2026" → "Octubre 2026", como el selector de la referencia. */
function monthOptionLabel(iso: string): string {
  const text = monthLabel(iso).replace(" de ", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

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
  useAutoStartTour("kpis-intro");
  const [periodMonth, setPeriodMonth] = useState(currentMonthIso());
  const [tab, setTab] = useState<"1" | "2" | "3" | "4" | "monthly">("monthly");
  const [setterId, setSetterId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [entries, setEntries] = useState<KpiEntryRow[] | null>(null);
  const [setters, setSetters] = useState<KpiSetterOption[]>([]);
  const [goals, setGoals] = useState<{ metricKey: string; targetValue: number }[]>([]);
  const [isPending, startTransition] = useTransition();
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
  const [sheets, setSheets] = useState<KpiSetterSheetInfo[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const months = useMemo(() => {
    const list = recentMonths();
    return list.includes(periodMonth) ? list : [periodMonth, ...list];
  }, [periodMonth]);

  useEffect(() => {
    if (!hasConnection) return;
    getKpiSetterSheetsAction().then(setSheets);
  }, [hasConnection]);

  // Estado de la sincronización con Google Sheets: la más reciente entre los
  // setters con hoja; si alguno falló, se avisa.
  const linkedSheets = (sheets ?? []).filter((s) => s.status === "active" && s.spreadsheetId);
  const lastSyncedAt = linkedSheets.reduce<string | null>((max, s) => (s.lastSyncedAt && (!max || s.lastSyncedAt > max) ? s.lastSyncedAt : max), null);
  const syncFailed = linkedSheets.some((s) => s.lastSyncStatus === "error");

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const result = await syncKpisNowAction();
      if (result.ok) toast.success("KPIs actualizados.");
      else toast.error(result.error ?? "Algunas hojas no se pudieron sincronizar.");
      const [rows, sheetRows] = await Promise.all([
        getKpiEntriesAction({
          periodMonth,
          weekNumber: tab === "monthly" ? undefined : Number(tab),
          setterId: setterId || undefined,
          teamId: teamId || undefined,
        }),
        getKpiSetterSheetsAction(),
      ]);
      setEntries(rows);
      setSheets(sheetRows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

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
            <Button onClick={() => (window.location.href = "/profile?tab=integrations")} size="sm" data-tour="kpis.connect-button">
              Ir a Integraciones
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
      <div className="grid grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 sm:flex sm:flex-wrap sm:gap-3" data-tour="kpis.filters">
        <Select label="Mes" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} containerClassName="w-full min-w-0 sm:w-auto">
          {months.map((m) => (
            <option key={m} value={m}>
              {monthOptionLabel(m)}
            </option>
          ))}
        </Select>
        <Select label="Setter" value={setterId} onChange={(e) => setSetterId(e.target.value)} containerClassName="w-full min-w-0 sm:w-auto">
          <option value="">Todos</option>
          {setters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </Select>
        <Select label="Equipo" value={teamId} onChange={(e) => setTeamId(e.target.value)} containerClassName="w-full min-w-0 sm:w-auto">
          <option value="">Todos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[13px] text-neutral-500 max-sm:text-xs">
          <span className={cn("size-2 shrink-0 rounded-full", syncFailed ? "bg-error" : lastSyncedAt ? "bg-success" : "bg-neutral-400")} aria-hidden="true" />
          <span className="line-clamp-2" suppressHydrationWarning>
            {sheets === null
              ? "Google Sheets"
              : syncFailed
                ? "Google Sheets: una hoja no se pudo sincronizar"
                : lastSyncedAt
                  ? `Google Sheets sincronizado ${timeAgo(lastSyncedAt)}`
                  : "Google Sheets todavía no se sincronizó"}
          </span>
        </p>
        <Button size="sm" variant="secondary" onClick={handleSyncNow} loading={syncing} className="shrink-0">
          {!syncing && <RefreshCw className="size-4" aria-hidden="true" />}
          Actualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [&_button]:shrink-0 [&_button]:whitespace-nowrap">
        {/* gap-2 en mobile: con el gap-5 de base "Mensual" (la activa por defecto) quedaba afuera a 390px. */}
        <TabsList className="max-sm:gap-2">
          <TabsTrigger value="1">Semana 1</TabsTrigger>
          <TabsTrigger value="2">Semana 2</TabsTrigger>
          <TabsTrigger value="3">Semana 3</TabsTrigger>
          <TabsTrigger value="4">Semana 4</TabsTrigger>
          <TabsTrigger value="monthly">Mensual</TabsTrigger>
        </TabsList>
      </Tabs>

      {!entries ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {FUNNEL.map((def, i) => {
              const value = def.pick(totals);
              const previous = i > 0 ? FUNNEL[i - 1].pick(totals) : 0;
              const caption = i === 0 ? "Primer paso" : previous > 0 ? `${Math.round((value / previous) * 100)}% del paso anterior` : "Sin datos del paso anterior";
              return <KpiCard key={def.key} def={def} value={value} caption={caption} tourId={i === 0 ? "kpis.tiles" : undefined} />;
            })}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {DETAIL.map((def) => (
              <KpiCard key={def.key} def={def} value={def.pick(totals)} />
            ))}
          </div>
        </>
      )}


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
                <BarChart data={weeklySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border-default)" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={32} />
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
