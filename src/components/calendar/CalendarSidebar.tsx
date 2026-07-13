"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { addDays, getMonday } from "@/lib/calendar/week";
import { MiniMonthCalendar } from "./MiniMonthCalendar";
import { CATEGORY_META, EVENT_TYPE_META, type CategoryKey } from "./eventTypeMeta";
import type { CalendarEvent } from "@/lib/calendar/queries";

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
}) {
  const [visibleMonth, setVisibleMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  function jumpTo(date: Date, view: "day" | "week" = "day") {
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    onSelectDate(date, view);
  }

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border-default bg-surface-2/60 p-5 lg:flex">
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
            className="size-4 rounded border-border-strong text-accent-500 focus:ring-accent-200"
          />
          Mi calendario
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={showTeam}
            onChange={onToggleTeam}
            className="size-4 rounded border-border-strong text-accent-500 focus:ring-accent-200"
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
              className="size-4 rounded border-border-strong text-accent-500 focus:ring-accent-200"
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
    </aside>
  );
}
