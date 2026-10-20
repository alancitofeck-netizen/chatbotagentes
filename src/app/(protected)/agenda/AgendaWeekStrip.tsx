"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AgendaAppointment } from "@/lib/agenda/queries";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DOW = ["D", "L", "M", "M", "J", "V", "S"];

/** Franja de días de la semana (look del mockup agenda-movil.html) — elige el día que se muestra
 * en la lista de citas de abajo. Siempre la semana (domingo a sábado) que contiene `weekAnchor`;
 * ‹ › la mueven una semana. Un punto bajo el número marca los días con al menos una cita (dentro
 * de la ventana ya cargada, ±90/60 días — no hace falta un fetch aparte). */
export function AgendaWeekStrip({
  weekAnchor,
  selectedDay,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  citas,
}: {
  weekAnchor: Date;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  citas: AgendaAppointment[];
}) {
  const today = startOfDay(new Date());
  const days = useMemo(() => {
    const start = startOfWeek(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekAnchor]);
  const hasCitaSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of citas) {
      if (c.deletedInSheet) continue;
      set.add(startOfDay(new Date(c.startTime)).toISOString());
    }
    return set;
  }, [citas]);

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border-default bg-surface-1 p-1.5">
      <button type="button" onClick={onPrevWeek} aria-label="Semana anterior" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-2 hover:text-foreground">
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDay);
          const hasCita = hasCitaSet.has(startOfDay(d).toISOString());
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelectDay(d)}
              aria-pressed={isSelected}
              className={`flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-lg text-[13px] font-semibold transition-colors ${
                isSelected ? "bg-accent-500 text-white" : isToday ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-2"
              }`}
            >
              <span className="text-[10px] font-bold uppercase opacity-80">{DOW[d.getDay()]}</span>
              <span className="text-[16px] tabular-nums">{d.getDate()}</span>
              <span className={`size-1.5 rounded-full ${hasCita ? (isSelected ? "bg-white" : "bg-accent-500") : "bg-transparent"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onNextWeek} aria-label="Semana siguiente" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-surface-2 hover:text-foreground">
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
