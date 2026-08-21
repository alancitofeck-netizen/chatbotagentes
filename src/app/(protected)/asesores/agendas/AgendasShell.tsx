"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  UserCheck,
  XCircle,
  Ban,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  Flame,
  BellRing,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AgendaAppointment, AgendaPerformance } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { getAgencyAgendaDataAction } from "@/lib/agenda/actions";
import { buildAgendaAlerts, type AgendaAlert } from "@/lib/agenda/alerts";
import { deltaPct } from "@/lib/clients/statsHelpers";
import { getMonday } from "@/lib/calendar/week";
import { StatTile } from "../StatTile";
import { AgendaAppointmentsTable } from "@/components/agenda/AgendaAppointmentsTable";
import { AgendaMiniCalendar } from "@/app/(protected)/agenda/AgendaMiniCalendar";
import { AgendaSetterPerformanceTable } from "./AgendaSetterPerformanceTable";
import { CitaDetailSheet } from "./CitaDetailSheet";

type PeriodType = "semana" | "mes" | "personalizado";

interface Range {
  start: string;
  end: string;
}

function toDateInputValue(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function weekRange(monday: Date): Range {
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  return { start: monday.toISOString(), end: end.toISOString() };
}

function monthRange(monthStart: Date): Range {
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  return { start: monthStart.toISOString(), end: end.toISOString() };
}

/** Solo semana/mes — "personalizado" se renderiza con dos <input type="date">
 * directamente (ver JSX más abajo), nunca pasa por acá. */
function periodLabel(periodType: "semana" | "mes", cursor: Date): string {
  if (periodType === "semana") {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    return `Semana ${cursor.toLocaleDateString("es", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  return cursor.toLocaleDateString("es", { month: "long", year: "numeric" });
}

const ALERT_META: Record<AgendaAlert["type"], { icon: typeof AlertTriangle; variant: "warning" | "error" | "info" }> = {
  sin_confirmar_hoy: { icon: BellRing, variant: "warning" },
  no_shows_consecutivos: { icon: Flame, variant: "error" },
  proximas_sin_confirmar: { icon: AlertTriangle, variant: "info" },
};

function alertText(alert: AgendaAlert): string {
  switch (alert.type) {
    case "sin_confirmar_hoy":
      return `${alert.count} cita${alert.count === 1 ? "" : "s"} de hoy todavía ${alert.count === 1 ? "no está confirmada" : "no están confirmadas"}.`;
    case "no_shows_consecutivos":
      return `${alert.setterName} tiene ${alert.streak} No Show consecutivos.`;
    case "proximas_sin_confirmar":
      return `Hay ${alert.count} cita${alert.count === 1 ? "" : "s"} en las próximas ${alert.withinHours}h sin confirmar.`;
  }
}

/** Asesores → Agendas: gestión de citas cross-asesor sobre agenda_appointments
 * (mismo pipeline de Performance — nunca bookings/Calendar). No reemplaza
 * Performance: esta pestaña mira QUÉ PASÓ con las citas ya generadas
 * (estado, asistencia, show rate); Performance mira los KPIs completos de
 * venta de cada setter (conexión, respuesta, calificadas, etc.) — mismo
 * criterio documentado en el pedido original del usuario. */
export function AgendasShell({ initialRange, initialAppointments, initialPerformance }: { initialRange: Range; initialAppointments: AgendaAppointment[]; initialPerformance: AgendaPerformance }) {
  const [periodType, setPeriodType] = useState<PeriodType>("semana");
  const [weekCursor, setWeekCursor] = useState(() => getMonday(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [customStart, setCustomStart] = useState(toDateInputValue(initialRange.start));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(initialRange.end));

  const [advisorFilter, setAdvisorFilter] = useState("");
  const [setterFilter, setSetterFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("");

  const [appointments, setAppointments] = useState(initialAppointments);
  const [performance, setPerformance] = useState(initialPerformance);
  const [isPending, startTransition] = useTransition();

  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(null);

  const [selectedCita, setSelectedCita] = useState<AgendaAppointment | null>(null);

  const range: Range = useMemo(() => {
    if (periodType === "semana") return weekRange(weekCursor);
    if (periodType === "mes") return monthRange(monthCursor);
    const end = new Date(customEnd);
    end.setDate(end.getDate() + 1);
    return { start: new Date(customStart).toISOString(), end: end.toISOString() };
  }, [periodType, weekCursor, monthCursor, customStart, customEnd]);

  useEffect(() => {
    if (range.start === initialRange.start && range.end === initialRange.end) return;
    startTransition(async () => {
      const result = await getAgencyAgendaDataAction(range);
      setAppointments(result.appointments);
      setPerformance(result.performance);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const filtered = useMemo(() => {
    return appointments.filter(
      (c) =>
        (!advisorFilter || c.advisorClientId === advisorFilter) &&
        (!setterFilter || c.setterId === setterFilter) &&
        (!estadoFilter || c.estadoCita === estadoFilter),
    );
  }, [appointments, advisorFilter, setterFilter, estadoFilter]);

  const dayFiltered = useMemo(() => {
    if (!calendarSelectedDate) return filtered;
    return filtered.filter((c) => {
      const d = new Date(c.startTime);
      return d.getFullYear() === calendarSelectedDate.getFullYear() && d.getMonth() === calendarSelectedDate.getMonth() && d.getDate() === calendarSelectedDate.getDate();
    });
  }, [filtered, calendarSelectedDate]);

  const advisorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of appointments) seen.set(c.advisorClientId, c.advisorName);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  const setterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of appointments) if (c.setterId) seen.set(c.setterId, c.setterName ?? "—");
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  const totals = performance.totals;
  const previousTotals = performance.previousTotals;
  const asistieron = totals.realizada + totals.venta;
  const previousAsistieron = previousTotals ? previousTotals.realizada + previousTotals.venta : 0;
  const showRate = totals.total === 0 ? 0 : Math.round((asistieron / totals.total) * 100);
  const previousShowRate = previousTotals && previousTotals.total > 0 ? Math.round((previousAsistieron / previousTotals.total) * 100) : null;
  const showRateDeltaPoints = previousShowRate === null ? null : Math.round((showRate - previousShowRate) * 10) / 10;

  const deltaSuffix = periodType === "semana" ? "vs semana anterior" : periodType === "mes" ? "vs mes anterior" : "vs período anterior";

  const nowIso = new Date().toISOString();
  const proximasCitas = useMemo(() => {
    return [...appointments]
      .filter((c) => c.startTime >= nowIso)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 5);
  }, [appointments, nowIso]);

  const alerts = useMemo(() => buildAgendaAlerts(appointments), [appointments]);

  function handleExport() {
    const params = new URLSearchParams({ start: range.start, end: range.end });
    window.open(`/api/agenda/export?${params.toString()}`, "_blank");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Período</span>
          <div className="flex gap-1 rounded-full bg-surface-2 p-1">
            {(["semana", "mes", "personalizado"] as PeriodType[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodType(p)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors ${
                  periodType === p ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {periodType !== "personalizado" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Fecha</span>
            <div className="flex items-center gap-1 rounded-md border border-border-default px-1.5 py-1">
              <button
                type="button"
                onClick={() =>
                  periodType === "semana"
                    ? setWeekCursor((d) => {
                        const n = new Date(d);
                        n.setDate(n.getDate() - 7);
                        return n;
                      })
                    : setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
                }
                className="flex size-7 items-center justify-center rounded text-neutral-500 hover:bg-surface-2 hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-[200px] text-center text-[13px] font-medium text-foreground capitalize">{periodLabel(periodType, periodType === "semana" ? weekCursor : monthCursor)}</span>
              <button
                type="button"
                onClick={() =>
                  periodType === "semana"
                    ? setWeekCursor((d) => {
                        const n = new Date(d);
                        n.setDate(n.getDate() + 7);
                        return n;
                      })
                    : setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
                }
                className="flex size-7 items-center justify-center rounded text-neutral-500 hover:bg-surface-2 hover:text-foreground"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Desde</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Hasta</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </div>
          </div>
        )}

        <Select label="Asesor" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {advisorOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        <Select label="Setter" value={setterFilter} onChange={(e) => setSetterFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {setterOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <Select label="Estado" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {ESTADO_CITA_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {ESTADO_CITA_META[o].label}
            </option>
          ))}
        </Select>

        <button
          type="button"
          onClick={handleExport}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-border-default px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2"
        >
          <Download className="size-4" aria-hidden="true" />
          Exportar
        </button>
      </div>

      {appointments.length === 0 && !isPending ? (
        <EmptyState icon={CalendarDays} title="Sin citas todavía" description="Ningún asesor tiene citas sincronizadas para este período." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <StatTile icon={CalendarDays} label="Citas totales" value={String(totals.total)} deltaPct={deltaPct(totals.total, previousTotals?.total ?? 0)} deltaSuffix={deltaSuffix} />
            <StatTile icon={CheckCircle2} label="Confirmadas" value={String(totals.confirmada)} deltaPct={deltaPct(totals.confirmada, previousTotals?.confirmada ?? 0)} deltaSuffix={deltaSuffix} />
            <StatTile icon={Clock} label="Pendientes" value={String(totals.agendada)} deltaPct={deltaPct(totals.agendada, previousTotals?.agendada ?? 0)} deltaSuffix={deltaSuffix} />
            <StatTile icon={UserCheck} label="Asistieron" value={String(asistieron)} deltaPct={deltaPct(asistieron, previousAsistieron)} deltaSuffix={deltaSuffix} />
            <StatTile icon={XCircle} label="No Show" value={String(totals.no_show)} deltaPct={deltaPct(totals.no_show, previousTotals?.no_show ?? 0)} deltaSuffix={deltaSuffix} />
            <StatTile icon={Ban} label="Canceladas" value={String(totals.cancelada)} deltaPct={deltaPct(totals.cancelada, previousTotals?.cancelada ?? 0)} deltaSuffix={deltaSuffix} />
            <StatTile icon={TrendingUp} label="Show Rate" value={`${showRate}%`} deltaPct={showRateDeltaPoints} deltaSuffix={`p.p. ${deltaSuffix}`} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <AgendaAppointmentsTable
              citas={dayFiltered}
              canEditEstado
              showAdvisorColumn
              sortable
              onRowClick={(cita) => setSelectedCita(cita)}
            />

            <div className="flex flex-col gap-4">
              <div>
                <AgendaMiniCalendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selectedDate={calendarSelectedDate ?? new Date(0)}
                  onSelectDate={(d) => setCalendarSelectedDate((prev) => (prev && prev.getTime() === d.getTime() ? null : d))}
                  appointments={filtered}
                />
              </div>

              <Card>
                <CardHeader title="Próximas citas" />
                {proximasCitas.length === 0 ? (
                  <p className="text-sm text-neutral-500">Sin citas próximas en este período.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {proximasCitas.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setSelectedCita(c)} className="flex w-full flex-col gap-0.5 rounded-md p-1.5 text-left hover:bg-surface-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium text-foreground">
                              {new Date(c.startTime).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {c.contactName ?? "Sin nombre"}
                            </span>
                            <Badge variant={ESTADO_CITA_META[c.estadoCita].variant}>{ESTADO_CITA_META[c.estadoCita].label}</Badge>
                          </div>
                          <span className="text-xs text-neutral-500">
                            Asesor: {c.advisorName} · Setter: {c.setterName ?? "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {alerts.length > 0 && (
                <Card>
                  <CardHeader title="Requiere atención" />
                  <ul className="flex flex-col gap-2.5">
                    {alerts.map((alert, i) => {
                      const meta = ALERT_META[alert.type];
                      const Icon = meta.icon;
                      return (
                        <li key={i} className="flex items-start gap-2 text-[13px]">
                          <Icon className={`mt-0.5 size-4 shrink-0 ${meta.variant === "error" ? "text-error-strong" : meta.variant === "warning" ? "text-warning-strong" : "text-info-strong"}`} aria-hidden="true" />
                          <span className="text-foreground">{alertText(alert)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </div>
          </div>

          <Card>
            <CardHeader title="Rendimiento de agendas por setter" />
            {performance.bySetter.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin datos para este período/filtros.</p>
            ) : (
              <AgendaSetterPerformanceTable rows={performance.bySetter} />
            )}
          </Card>
        </>
      )}

      {selectedCita && <CitaDetailSheet cita={selectedCita} canEditEstado onClose={() => setSelectedCita(null)} />}
    </div>
  );
}
