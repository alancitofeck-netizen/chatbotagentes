"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import type { AgendaAppointment } from "@/lib/agenda/queries";

const WEEKDAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Calendario mensual interactivo — cada punto es una cita real de ese día
 * (agenda_appointments, nunca decorativo). Clickear un día navega Agenda a
 * ese día puntual (mismo criterio "todo lo que se ve es funcional" pedido
 * por el usuario); las flechas cambian de mes sin perder el día
 * seleccionado. */
export function AgendaMiniCalendar({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  appointments,
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
  selectedDate: Date;
  onSelectDate: (day: Date) => void;
  appointments: AgendaAppointment[];
}) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // lunes=0
  const today = new Date();

  const countByDay = new Map<number, number>();
  for (const a of appointments) {
    const d = new Date(a.startTime);
    if (d.getFullYear() === year && d.getMonth() === monthIdx) {
      countByDay.set(d.getDate(), (countByDay.get(d.getDate()) ?? 0) + 1);
    }
  }

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <Card>
      <CardHeader
        title={month.toLocaleDateString("es", { month: "long", year: "numeric" })}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => onMonthChange(new Date(year, monthIdx - 1, 1))}
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => onMonthChange(new Date(year, monthIdx + 1, 1))}
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEADERS.map((w, i) => (
          <span key={`${w}-${i}`} className="text-[11px] font-medium text-neutral-400">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} />;
          const date = new Date(year, monthIdx, day);
          const count = countByDay.get(day) ?? 0;
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, selectedDate);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`flex flex-col items-center gap-0.5 rounded-md py-1 text-xs transition-colors ${
                isSelected
                  ? "bg-accent-500 font-semibold text-white"
                  : isToday
                    ? "bg-accent-500/15 font-semibold text-accent-700"
                    : "text-foreground hover:bg-surface-2"
              }`}
            >
              {day}
              <span
                className={`size-1 rounded-full ${count > 0 ? (isSelected ? "bg-white" : "bg-accent-500") : "bg-transparent"}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
