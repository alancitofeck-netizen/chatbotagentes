"use client";

import { useMemo } from "react";
import type { AgendaAppointment } from "@/lib/agenda/queries";

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 3 tiles (look del mockup): citas del día seleccionado, % de asistencia del mes en curso
 * (realizada vs. realizada+no_show), y "Sin resultado" — citas vencidas que siguen "Agendada"/
 * "Propuesta", clickeable para alternar la lista de abajo a esa vista (igual que el botón
 * `pendBtn` del mockup). */
export function AgendaStatsRow({
  citas,
  selectedDay,
  pendingActive,
  onTogglePending,
}: {
  citas: AgendaAppointment[];
  selectedDay: Date;
  pendingActive: boolean;
  onTogglePending: () => void;
}) {
  const stats = useMemo(() => {
    const live = citas.filter((c) => !c.deletedInSheet);
    const now = new Date();
    const citasDelDia = live.filter((c) => isSameDay(new Date(c.startTime), selectedDay)).length;
    const mes = live.filter((c) => isSameMonth(new Date(c.startTime), now) && (c.estadoCita === "realizada" || c.estadoCita === "no_show"));
    const asistieron = mes.filter((c) => c.estadoCita === "realizada").length;
    const asistencia = mes.length ? Math.round((asistieron / mes.length) * 100) : 0;
    const today = startOfDay(now);
    const sinResultado = live.filter((c) => new Date(c.startTime) < today && (c.estadoCita === "agendada" || c.estadoCita === "propuesta")).length;
    return { citasDelDia, asistencia, sinResultado };
  }, [citas, selectedDay]);

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col gap-0.5 rounded-xl border border-border-default bg-surface-1 p-3">
        <span className="font-display text-[20px] leading-none font-semibold tabular-nums text-foreground">{stats.citasDelDia}</span>
        <span className="text-[11.5px] font-medium text-neutral-500">Citas del día</span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-xl border border-border-default bg-surface-1 p-3">
        <span className="font-display text-[20px] leading-none font-semibold tabular-nums text-foreground">{stats.asistencia}%</span>
        <span className="text-[11.5px] font-medium text-neutral-500">Asistencia</span>
      </div>
      <button
        type="button"
        onClick={onTogglePending}
        aria-pressed={pendingActive}
        className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left ${pendingActive ? "border-warning-strong" : "border-warning/30"} bg-warning-bg`}
      >
        <span className="font-display text-[20px] leading-none font-semibold tabular-nums text-warning-strong">{stats.sinResultado}</span>
        <span className="text-[11.5px] font-medium text-warning-strong">Sin resultado ›</span>
      </button>
    </div>
  );
}
