"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { CalendarDays, Users2, UserRound, Loader2, SlidersHorizontal, CalendarSearch, X, Plus, FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMonday, addDays } from "@/lib/calendar/week";
import { getAgendaAppointmentsAction } from "@/lib/agenda/actions";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { AgendaTimeline } from "./AgendaTimeline";
import { AgendaAppointmentsTable } from "@/components/agenda/AgendaAppointmentsTable";
import { AgendaMiniCalendar } from "./AgendaMiniCalendar";
import { AgendaKpiTiles } from "./AgendaKpiTiles";
import { AgendaEstadoDonut } from "./AgendaEstadoDonut";
import { AgendaTipoBars } from "./AgendaTipoBars";
import { AgendaAttendanceRate } from "./AgendaAttendanceRate";
import { useAgendaPerformance } from "./useAgendaPerformance";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

const GRANULARITY_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "dia", label: "Día" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
];

type Granularity = "dia" | "semana" | "mes";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function rangeFor(granularity: Granularity, selectedDate: Date): { start: string; end: string } {
  const day = startOfDay(selectedDate);
  if (granularity === "dia") return { start: day.toISOString(), end: addDays(day, 1).toISOString() };
  if (granularity === "semana") {
    const monday = getMonday(day);
    return { start: monday.toISOString(), end: addDays(monday, 7).toISOString() };
  }
  const monthStart = firstOfMonth(day);
  return { start: monthStart.toISOString(), end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).toISOString() };
}

function dateHeaderLabel(granularity: Granularity, selectedDate: Date): string {
  const today = new Date();
  const tomorrow = addDays(startOfDay(today), 1);
  if (granularity === "dia") {
    const prefix = isSameDay(selectedDate, today) ? "Hoy, " : isSameDay(selectedDate, tomorrow) ? "Mañana, " : "";
    return prefix + selectedDate.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  }
  if (granularity === "semana") {
    const monday = getMonday(startOfDay(selectedDate));
    const sunday = addDays(monday, 6);
    return `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${sunday.toLocaleDateString("es-MX", { month: "long" })}`;
  }
  return selectedDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function weekdayLabel(selectedDate: Date): string {
  const label = selectedDate.toLocaleDateString("es-MX", { weekday: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Vista operativa de Agenda — línea de tiempo del día / lista agrupada
 * semana-mes, calendario mini interactivo, próximas citas, KPIs
 * automáticos y tabla completa con filtros/búsqueda/export — todo sobre
 * agenda_appointments real (espejo de la hoja KPI, ver
 * src/lib/agenda/queries.ts), nunca datos de ejemplo. Un 'agent' (setter)
 * recibe del server solo sus propias citas (isManager=false esconde el
 * toggle de scope porque no hay nada que alternar; la edición de estado sí
 * está disponible para los 3 roles, ver CitaCard/AgendaAppointmentsTable). */
export function AgendaShell({ isManager }: { isManager: boolean }) {
  useAutoStartTour("agenda-intro");
  const [granularity, setGranularity] = useState<Granularity>("dia");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => firstOfMonth(new Date()));

  const [citas, setCitas] = useState<AgendaAppointment[] | null>(null);
  const [monthCitas, setMonthCitas] = useState<AgendaAppointment[]>([]);
  const [loading, startTransition] = useTransition();

  const analytics = useAgendaPerformance(isManager);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newCitaOpen, setNewCitaOpen] = useState(false);
  const [setterFilter, setSetterFilter] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const range = useMemo(() => rangeFor(granularity, selectedDate), [granularity, selectedDate]);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const data = await getAgendaAppointmentsAction(range);
      if (!cancelled) setCitas(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);


  useEffect(() => {
    let cancelled = false;
    const start = firstOfMonth(calendarMonth);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    getAgendaAppointmentsAction({ start: start.toISOString(), end: end.toISOString() }).then((data) => {
      if (!cancelled) setMonthCitas(data);
    });
    return () => {
      cancelled = true;
    };
  }, [calendarMonth]);

  const setterOptions = useMemo(() => [...new Set((citas ?? []).map((c) => c.setterName).filter((n): n is string => !!n))].sort(), [citas]);
  const advisorOptions = useMemo(() => [...new Set((citas ?? []).map((c) => c.advisorName))].sort(), [citas]);

  const filteredCitas = useMemo(() => {
    let rows = citas ?? [];
    if (setterFilter) rows = rows.filter((c) => c.setterName === setterFilter);
    if (advisorFilter) rows = rows.filter((c) => c.advisorName === advisorFilter);
    return rows;
  }, [citas, setterFilter, advisorFilter]);

  const activeTab = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    if (granularity === "dia" && isSameDay(selectedDate, today)) return "hoy";
    if (granularity === "dia" && isSameDay(selectedDate, tomorrow)) return "manana";
    if (granularity === "semana") return "semana";
    if (granularity === "mes") return "mes";
    return null;
  }, [granularity, selectedDate]);

  const exportHref = `/api/agenda/export?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`;
  const activeFilterCount = (setterFilter ? 1 : 0) + (advisorFilter ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1" data-tour="agenda.range-switcher">
          {[
            {
              key: "hoy",
              label: "Hoy",
              onClick: () => {
                setGranularity("dia");
                setSelectedDate(startOfDay(new Date()));
              },
            },
            {
              key: "manana",
              label: "Mañana",
              onClick: () => {
                setGranularity("dia");
                setSelectedDate(addDays(startOfDay(new Date()), 1));
              },
            },
            { key: "semana", label: "Semana", onClick: () => setGranularity("semana") },
            { key: "mes", label: "Mes", onClick: () => setGranularity("mes") },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={v.onClick}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                activeTab === v.key ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {isManager ? (
          <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
            <Users2 className="size-3.5" aria-hidden="true" />
            Vista de equipo — todas las citas gestionadas
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
            <UserRound className="size-3.5" aria-hidden="true" />
            Mis citas
          </span>
        )}

        <div className="relative ml-auto">
          <button
            type="button"
            data-tour="agenda.new-cita-button"
            onClick={() => setNewCitaOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-accent-600"
          >
            <Plus size={15} aria-hidden="true" />
            Nueva cita
          </button>
          {newCitaOpen && (
            <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-md)]">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                  <FileSpreadsheet size={14} className="text-accent-600" aria-hidden="true" />
                  Las citas vienen de tu hoja
                </p>
                <button type="button" onClick={() => setNewCitaOpen(false)} className="text-neutral-400 hover:text-foreground">
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              <p className="mb-3 text-[12.5px] text-neutral-500">
                Para no duplicar la carga, Agenda no crea citas manualmente — cargá o actualizá la cita en tu hoja de Google Sheets conectada y se sincroniza sola en minutos.
              </p>
              <Link href="/profile?tab=integrations" data-tour="agenda.sheet-connect-link" className="text-[12.5px] font-medium text-accent-600 hover:text-accent-700">
                Gestionar mi hoja conectada →
              </Link>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            title="Ir a una fecha"
            className="flex size-8 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            <CalendarSearch size={15} aria-hidden="true" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="pointer-events-none absolute inset-0 opacity-0"
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              setGranularity("dia");
              setSelectedDate(new Date(y, m - 1, d));
              setCalendarMonth(new Date(y, m - 1, 1));
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[17px] font-semibold text-foreground">{dateHeaderLabel(granularity, selectedDate)}</h2>
              {granularity === "dia" && (
                <span className="rounded-full bg-accent-500/10 px-2.5 py-0.5 text-[12px] font-medium text-accent-600">{weekdayLabel(selectedDate)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
                title="Agrupar la vista por día, semana o mes"
                className="rounded-md border border-border-default bg-surface-1 px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
              >
                {GRANULARITY_OPTIONS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
              <div className="relative">
                <button
                  type="button"
                  data-tour="agenda.filters-button"
                  onClick={() => setFiltersOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                Filtros
                {activeFilterCount > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-accent-500 text-[10px] text-white">{activeFilterCount}</span>}
              </button>
              {filtersOpen && (
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-md)]">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-foreground">Filtrar citas</p>
                    <button type="button" onClick={() => setFiltersOpen(false)} className="text-neutral-400 hover:text-foreground">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex flex-col gap-1 text-[12px] text-neutral-500">
                      Setter
                      <select value={setterFilter} onChange={(e) => setSetterFilter(e.target.value)} className="rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-[13px] text-foreground">
                        <option value="">Todos</option>
                        {setterOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    {isManager && advisorOptions.length > 1 && (
                      <label className="flex flex-col gap-1 text-[12px] text-neutral-500">
                        Asesor
                        <select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)} className="rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-[13px] text-foreground">
                          <option value="">Todos</option>
                          {advisorOptions.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSetterFilter("");
                          setAdvisorFilter("");
                        }}
                        className="self-start text-[12px] font-medium text-accent-600 hover:text-accent-700"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>

          {loading && !citas ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Cargando agenda…
            </div>
          ) : !citas ? (
            <EmptyState icon={CalendarDays} title="Sin citas en este rango" description="No hay citas agendadas para el período seleccionado." />
          ) : (
            <AgendaTimeline citas={filteredCitas} granularity={granularity} canEditEstado />
          )}

          <AgendaAppointmentsTable citas={filteredCitas} canEditEstado exportHref={exportHref} />

          {isManager && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <AgendaEstadoDonut data={analytics.data} />
              <AgendaTipoBars data={analytics.data} />
              <AgendaAttendanceRate data={analytics.data} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {isManager && <AgendaKpiTiles data={analytics.data} preset={analytics.preset} onPresetChange={analytics.setPreset} loading={analytics.loading} />}
          <AgendaMiniCalendar
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedDate={selectedDate}
            onSelectDate={(day) => {
              setGranularity("dia");
              setSelectedDate(day);
            }}
            appointments={monthCitas}
          />
        </div>
      </div>
    </div>
  );
}
