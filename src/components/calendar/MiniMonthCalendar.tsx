"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { addDays, getMonday } from "@/lib/calendar/week";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Small month picker in the sidebar — independent from the main grid's
 * `date`/`view` (clicking a day here always jumps to Day view for that
 * date, same as clicking a day number in MonthView). `visibleMonth` is
 * whatever month is currently being browsed here, separate from the
 * calendar's own visible range so paging the mini calendar doesn't move
 * the main grid until a day is actually clicked. */
export function MiniMonthCalendar({
  visibleMonth,
  selectedDate,
  onVisibleMonthChange,
  onSelectDate,
}: {
  visibleMonth: Date;
  selectedDate: Date;
  onVisibleMonthChange: (date: Date) => void;
  onSelectDate: (date: Date) => void;
}) {
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const gridStart = getMonday(firstOfMonth);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold capitalize text-foreground">
          {visibleMonth.toLocaleDateString("es", { month: "long", year: "numeric" })}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => onVisibleMonthChange(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
            className="flex size-6 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => onVisibleMonthChange(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
            className="flex size-6 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
          <span key={`${d}-${i}`} className="text-[10px] font-medium text-neutral-400">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === visibleMonth.getMonth();
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "mx-auto flex size-6 items-center justify-center rounded-full text-[11px] transition-colors",
                !inMonth && "text-neutral-300",
                inMonth && !isSelected && "text-foreground hover:bg-surface-3",
                isToday && !isSelected && "font-semibold text-accent-600",
                isSelected && "bg-accent-500 font-semibold text-white hover:bg-accent-600",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
