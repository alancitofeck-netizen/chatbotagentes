"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { addDays, getMonday } from "@/lib/calendar/week";
import type { TaskItem } from "@/lib/tasks/queries";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Calendario" view — a lightweight month grid grouping tasks by `due_at`,
 * built independently from the Calendar module's MonthView.tsx (that one is
 * coupled to the `bookings` row shape; reusing it here would introduce an
 * unnecessary cross-module dependency for what's fundamentally the same
 * "42-cell month grid" math, reused instead via the pure date helpers in
 * src/lib/calendar/week.ts). */
export function TaskCalendarView({ tasks, onOpen }: { tasks: TaskItem[]; onOpen: (task: TaskItem) => void }) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const days = useMemo(() => {
    const gridStart = getMonday(visibleMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [visibleMonth]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const key = dayKey(new Date(t.dueAt));
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    return map;
  }, [tasks]);

  const today = new Date();

  return (
    <div className="rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <span className="text-[15px] font-semibold capitalize text-foreground">
          {visibleMonth.toLocaleDateString("es", { month: "long", year: "numeric" })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border-default text-center text-xs font-medium text-neutral-400">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <span key={d} className="py-2">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getMonth() === visibleMonth.getMonth();
          const isToday = isSameDay(day, today);
          const dayTasks = tasksByDay.get(dayKey(day)) ?? [];
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex min-h-[100px] flex-col gap-1 border-b border-r border-border-default p-1.5",
                !inMonth && "bg-surface-2/40",
              )}
            >
              <span className={cn("text-[11px]", inMonth ? "text-neutral-500" : "text-neutral-300", isToday && "font-semibold text-accent-600")}>
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t)}
                    title={t.title}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                      t.priority === "urgent" || t.priority === "high" ? "bg-error-bg text-error-strong" : "bg-accent-100 text-accent-700",
                      t.status === "completed" && "text-neutral-400 line-through",
                    )}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && <span className="text-[10px] text-neutral-400">+{dayTasks.length - 3} más</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
