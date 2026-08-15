"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarDays } from "lucide-react";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { CitaCard } from "./CitaCard";

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 18;

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatDayGroup(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" });
}

/** Vista de un solo día: filas por hora (09:00-18:00 por defecto, se
 * extiende si hay citas fuera de ese rango) con las citas reales de esa
 * hora — nunca horarios inventados, solo agenda_appointments agrupadas por
 * la hora de su start_time real. */
function DayTimeline({ citas, canEditEstado }: { citas: AgendaAppointment[]; canEditEstado: boolean }) {
  const { startHour, endHour, byHour } = useMemo(() => {
    const byHourMap = new Map<number, AgendaAppointment[]>();
    let minHour = DEFAULT_START_HOUR;
    let maxHour = DEFAULT_END_HOUR;
    for (const cita of citas) {
      const hour = new Date(cita.startTime).getHours();
      const list = byHourMap.get(hour) ?? [];
      list.push(cita);
      byHourMap.set(hour, list);
      if (hour < minHour) minHour = hour;
      if (hour > maxHour) maxHour = hour;
    }
    return { startHour: minHour, endHour: maxHour, byHour: byHourMap };
  }, [citas]);

  if (citas.length === 0) {
    return <EmptyState icon={CalendarDays} title="Sin citas en este día" description="No hay citas agendadas para el día seleccionado." />;
  }

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div className="flex flex-col">
      {hours.map((hour) => {
        const hourCitas = byHour.get(hour) ?? [];
        return (
          <div key={hour} className="flex gap-4 border-t border-border-default py-3 first:border-t-0">
            <span className="w-12 shrink-0 pt-1 text-[13px] font-medium text-neutral-400">{formatHour(hour)}</span>
            <div className="flex-1">
              {hourCitas.length === 0 ? (
                <div className="h-1" />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {hourCitas.map((cita) => (
                    <CitaCard key={cita.id} cita={cita} canEditEstado={canEditEstado} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Vista de varios días (semana/mes): agrupada por día, mismo formato que
 * usaba AgendaShell antes de este rediseño. */
function GroupedByDay({ citas, canEditEstado }: { citas: AgendaAppointment[]; canEditEstado: boolean }) {
  const grouped = useMemo(() => {
    const map = new Map<string, AgendaAppointment[]>();
    for (const cita of citas) {
      const key = formatDayGroup(cita.startTime);
      const list = map.get(key) ?? [];
      list.push(cita);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [citas]);

  if (citas.length === 0) {
    return <EmptyState icon={CalendarDays} title="Sin citas en este rango" description="No hay citas agendadas para el período seleccionado." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map(([day, dayCitas]) => (
        <div key={day} className="flex flex-col gap-3">
          <p className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase">{day}</p>
          <div className="flex flex-col gap-2.5">
            {dayCitas.map((cita) => (
              <CitaCard key={cita.id} cita={cita} canEditEstado={canEditEstado} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgendaTimeline({ citas, granularity, canEditEstado }: { citas: AgendaAppointment[]; granularity: "dia" | "semana" | "mes"; canEditEstado: boolean }) {
  if (granularity === "dia") return <DayTimeline citas={citas} canEditEstado={canEditEstado} />;
  return <GroupedByDay citas={citas} canEditEstado={canEditEstado} />;
}
