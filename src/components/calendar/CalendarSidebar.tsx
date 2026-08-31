"use client";

import { useState } from "react";
import { CalendarDays, Search, Clock, CircleCheck, AlertTriangle, Link2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { addDays, getMonday } from "@/lib/calendar/week";
import { MiniMonthCalendar } from "./MiniMonthCalendar";
import { CATEGORY_META, EVENT_TYPE_META, type CategoryKey } from "./eventTypeMeta";
import type { DaySummary, DayInsights } from "./calendarInsights";
import type { CalendarEvent } from "@/lib/calendar/queries";

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatUpcoming(event: CalendarEvent) {
  const start = new Date(event.startTime);
  const isToday = new Date().toDateString() === start.toDateString();
  const dateLabel = isToday
    ? "Hoy"
    : start.toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short" });
  const timeLabel = start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel}, ${timeLabel}`;
}

/** Sidebar bundled inside the Calendar page (not the app's global sidebar) —
 * mini month picker + quick-jump buttons + scope/category filters. There's
 * no multi-"calendar" concept in the data model (no separate calendars
 * table), so "Mi calendario"/"Equipo" are an assignee-scope filter over the
 * same `bookings` rows, and the category checkboxes bucket the 6 real
 * event_type values into the 5 named groups from the reference design —
 * this intentionally merges what the spec described as two separate blocks
 * ("Calendarios activos" + "Filtros") into one filter panel, since both were
 * filtering the same underlying event list along overlapping axes. */
export function CalendarSidebar({
  selectedDate,
  onSelectDate,
  showMine,
  showTeam,
  onToggleMine,
  onToggleTeam,
  activeCategories,
  onToggleCategory,
  upcomingEvent,
  onOpenUpcoming,
  search,
  onSearchChange,
  todaySummary,
  todayInsights,
  googleCalendarConnected,
}: {
  selectedDate: Date;
  onSelectDate: (date: Date, view: "day" | "week") => void;
  showMine: boolean;
  showTeam: boolean;
  onToggleMine: () => void;
  onToggleTeam: () => void;
  activeCategories: Set<CategoryKey>;
  onToggleCategory: (key: CategoryKey) => void;
  upcomingEvent: CalendarEvent | null;
  onOpenUpcoming: (event: CalendarEvent) => void;
  search: string;
  onSearchChange: (value: string) => void;
  todaySummary: DaySummary;
  todayInsights: DayInsights;
  googleCalendarConnected: boolean;
}) {
  const [visibleMonth, setVisibleMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  function jumpTo(date: Date, view: "day" | "week" = "day") {
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    onSelectDate(date, view);
  }

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border-default bg-surface-2/60 p-5 lg:flex">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar evento o contacto…"
          className="w-full rounded-full border border-border-strong bg-surface-1 py-2 pl-8 pr-3 text-[13px] outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-100"
        />
      </div>

      {/* Resumen del día — cálculo determinístico sobre una jornada fija
          9–18 (todavía no existe un horario laboral configurable por
          usuario). Detalle: "AI" del pedido = matemática de intervalos, sin
          llamada nueva a un modelo. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-xs)]">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Resumen de hoy</h3>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-neutral-600">
            <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" /> Ocupado
          </span>
          <span className="font-medium text-foreground">{formatHours(todaySummary.busyMinutes)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-neutral-600">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" /> Libre
          </span>
          <span className="font-medium text-foreground">{formatHours(todaySummary.freeMinutes)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-neutral-600">Reuniones</span>
          <span className="font-medium text-foreground">{todaySummary.meetingCount}</span>
        </div>

        {(todayInsights.conflicts.length > 0 || todayInsights.gaps.length > 0 || todayInsights.backToBackCount > 0) && (
          <div className="mt-1 flex flex-col gap-1.5 border-t border-border-default pt-2">
            {todayInsights.conflicts.length > 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-red-600">
                <AlertTriangle size={12} aria-hidden="true" /> {todayInsights.conflicts.length} conflicto(s) de horario
              </p>
            )}
            {todayInsights.backToBackCount > 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-amber-600">
                <Clock size={12} aria-hidden="true" /> {todayInsights.backToBackCount} reunión(es) consecutiva(s), sin margen
              </p>
            )}
            {todayInsights.gaps.length > 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-emerald-600">
                <CircleCheck size={12} aria-hidden="true" /> {todayInsights.gaps.length} hueco(s) libre(s) de 30m+
              </p>
            )}
          </div>
        )}
      </div>

      {upcomingEvent && (
        <button
          type="button"
          onClick={() => onOpenUpcoming(upcomingEvent)}
          className="flex flex-col gap-1.5 rounded-xl border border-border-default bg-surface-1 p-3.5 text-left shadow-[var(--elevation-xs)] transition-shadow hover:shadow-[var(--elevation-sm)]"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            <CalendarDays size={12} aria-hidden="true" />
            Próximo evento
          </span>
          <span className="truncate text-sm font-semibold text-foreground">{upcomingEvent.title}</span>
          <span className="text-xs text-neutral-500">{formatUpcoming(upcomingEvent)}</span>
        </button>
      )}

      <MiniMonthCalendar
        visibleMonth={visibleMonth}
        selectedDate={selectedDate}
        onVisibleMonthChange={setVisibleMonth}
        onSelectDate={(day) => jumpTo(day, "day")}
      />

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => jumpTo(new Date(), "day")}
          className="rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground hover:bg-surface-3"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => jumpTo(addDays(new Date(), 1), "day")}
          className="rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground hover:bg-surface-3"
        >
          Mañana
        </button>
        <button
          type="button"
          onClick={() => jumpTo(getMonday(new Date()), "week")}
          className="rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground hover:bg-surface-3"
        >
          Esta semana
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Calendarios</h3>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={showMine}
            onChange={onToggleMine}
            className="size-4 rounded border-border-strong text-blue-600 focus:ring-blue-200"
          />
          Mi calendario
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={showTeam}
            onChange={onToggleTeam}
            className="size-4 rounded border-border-strong text-blue-600 focus:ring-blue-200"
          />
          Equipo
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Filtros</h3>
        {(Object.entries(CATEGORY_META) as [CategoryKey, (typeof CATEGORY_META)[CategoryKey]][]).map(([key, meta]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={activeCategories.has(key)}
              onChange={() => onToggleCategory(key)}
              className="size-4 rounded border-border-strong text-blue-600 focus:ring-blue-200"
            />
            <span className={cn("size-2 rounded-full", meta.solid)} aria-hidden="true" />
            {meta.label}
          </label>
        ))}
        {/* "Demo" folds into "Reuniones" above (see categoryFor in eventTypeMeta.ts) but keeps its own accent color on the grid itself. */}
        <p className="mt-0.5 text-[11px] text-neutral-400">
          <span className={cn("mr-1 inline-block size-2 rounded-full align-middle", EVENT_TYPE_META.demo.solid)} aria-hidden="true" />
          Demos se agrupan en Reuniones
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Calendarios conectados</h3>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-foreground">
            <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" /> Calendario interno
          </span>
          <span className="text-[11px] text-neutral-400">Siempre activo</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-foreground">
            <span className={cn("size-2 rounded-full", googleCalendarConnected ? "bg-emerald-500" : "bg-neutral-300")} aria-hidden="true" />
            Google Calendar
          </span>
          {googleCalendarConnected ? (
            <span className="text-[11px] font-medium text-emerald-600">Conectado</span>
          ) : (
            <a href="/profile?tab=integrations" data-tour="calendar.google-connect" className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
              <Link2 size={11} aria-hidden="true" /> Conectar
            </a>
          )}
        </div>
        <div className="flex items-center justify-between text-[13px] opacity-50">
          <span className="flex items-center gap-1.5 text-foreground">
            <span className="size-2 rounded-full bg-neutral-300" aria-hidden="true" /> Outlook
          </span>
          <span className="text-[11px] text-neutral-400">Próximamente</span>
        </div>
      </div>
    </aside>
  );
}
