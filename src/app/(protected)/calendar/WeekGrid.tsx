"use client";

import { cn } from "@/lib/utils/cn";
import type { CalendarBooking } from "@/lib/calendar/queries";
import { addDays } from "@/lib/calendar/week";

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 56; // px
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const RANGE_MINUTES = (END_HOUR - START_HOUR) * 60;
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesSinceRangeStart(date: Date, day: Date) {
  const rangeStart = new Date(day);
  rangeStart.setHours(START_HOUR, 0, 0, 0);
  return (date.getTime() - rangeStart.getTime()) / 60000;
}

export function WeekGrid({
  weekStart,
  bookings,
  onSelect,
}: {
  weekStart: Date;
  bookings: CalendarBooking[];
  onSelect: (booking: CalendarBooking) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="flex min-w-[840px]">
      <div className="w-14 shrink-0 pt-[41px]">
        {HOURS.map((h) => (
          <div key={h} style={{ height: HOUR_HEIGHT }} className="pr-2 text-right text-[11px] text-neutral-400">
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7">
        {days.map((day) => {
          const dayIsToday = isSameDay(day, today);
          const dayBookings = bookings.filter((b) => isSameDay(new Date(b.startTime), day));

          return (
            <div key={day.toISOString()} className="border-l border-border-default">
              <div
                className={cn(
                  "flex h-10 flex-col items-center justify-center border-b border-border-default text-xs",
                  dayIsToday ? "font-semibold text-accent-600" : "text-neutral-500",
                )}
              >
                <span className="capitalize">{day.toLocaleDateString("es", { weekday: "short" })}</span>
                <span>{day.toLocaleDateString("es", { day: "2-digit", month: "2-digit" })}</span>
              </div>
              <div
                className={cn("relative", dayIsToday && "bg-accent-50/40")}
                style={{ height: GRID_HEIGHT }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    className="absolute inset-x-0 border-t border-border-default/60"
                  />
                ))}
                {dayBookings.map((b) => {
                  const start = Math.min(Math.max(minutesSinceRangeStart(new Date(b.startTime), day), 0), RANGE_MINUTES);
                  const end = Math.min(Math.max(minutesSinceRangeStart(new Date(b.endTime), day), 0), RANGE_MINUTES);
                  const top = (start / RANGE_MINUTES) * GRID_HEIGHT;
                  const height = Math.max(((end - start) / RANGE_MINUTES) * GRID_HEIGHT, 20);
                  const isPast = new Date(b.endTime) < today && b.status !== "cancelled";
                  const isCancelled = b.status === "cancelled";

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelect(b)}
                      style={{ top, height }}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-sm px-1.5 py-1 text-left text-[11px] leading-tight transition-colors",
                        isCancelled
                          ? "bg-surface-3 text-neutral-400 line-through"
                          : isPast
                            ? "bg-surface-3 text-neutral-500"
                            : "bg-accent-100 text-accent-700 hover:bg-accent-200",
                      )}
                    >
                      <div className="truncate font-medium">{b.subject || "Sin asunto"}</div>
                      <div className="truncate">{b.contactName}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
