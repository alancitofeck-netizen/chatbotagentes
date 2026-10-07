"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarClock, Send } from "lucide-react";
import { getAgendaAppointmentsAction } from "@/lib/agenda/actions";
import type { AgendaAppointment } from "@/lib/agenda/queries";

const DAYS_SHOWN = 7;
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const noopSubscribe = () => () => {};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/** Agenda de mobile como en la referencia: tira de 7 días con punto en los días
 * con reuniones, agenda libre del día elegido y próximas reuniones. Todo sale de
 * las citas reales del workspace (las mismas que la vista de escritorio). */
export function AgendaMobileHome() {
  // La fecha de hoy se lee sólo en el cliente: el servidor corre en UTC y el
  // usuario en hora de Buenos Aires, así que no se renderiza en el HTML inicial.
  const todayMs = useSyncExternalStore(
    noopSubscribe,
    () => startOfDay(new Date()).getTime(),
    () => null,
  );
  const [citas, setCitas] = useState<AgendaAppointment[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (todayMs === null) return;
    const start = new Date(todayMs);
    const end = addDays(start, DAYS_SHOWN);
    let cancelled = false;
    getAgendaAppointmentsAction({ start: start.toISOString(), end: end.toISOString() })
      .then((data) => {
        if (!cancelled) setCitas(data);
      })
      .catch(() => {
        if (!cancelled) setCitas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [todayMs]);

  if (todayMs === null) return null;

  const today = new Date(todayMs);
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i));
  const active = (citas ?? []).filter((c) => c.estadoCita !== "cancelada");
  const citasOn = (day: Date) => active.filter((c) => sameDay(new Date(c.startTime), day));
  const selectedDay = days[selectedIndex];
  const selectedCitas = citasOn(selectedDay).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcoming = active
    .filter((c) => new Date(c.startTime).getTime() >= (todayMs ?? 0))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 md:hidden">
      <header className="flex items-center gap-3.5">
        <span className="flex size-[54px] shrink-0 items-center justify-center rounded-lg bg-navy text-white shadow-[var(--elevation-md)]">
          <CalendarClock className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground">Agenda</h1>
          <p className="mt-1 text-sm text-neutral-500">Tus reuniones con leads y clientes.</p>
        </div>
      </header>

      <div role="group" aria-label="Elegir día" className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isSelected = i === selectedIndex;
          const hasCitas = citasOn(day).length > 0;
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => setSelectedIndex(i)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 transition-colors ${
                isSelected ? "navy-card border-transparent text-white" : "border-border-default bg-surface-1 text-foreground"
              }`}
            >
              <span className={`text-[11px] font-medium ${isSelected ? "text-white/70" : "text-neutral-500"}`}>{i === 0 ? "Hoy" : WEEKDAYS[day.getDay()].slice(0, 3)}</span>
              <span className="font-display text-[18px] leading-none font-semibold tabular-nums">{day.getDate()}</span>
              <span className={`mt-0.5 size-1.5 rounded-full ${hasCitas ? "bg-accent-500" : "bg-transparent"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {citas !== null && selectedCitas.length === 0 && (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent-500/40 bg-surface-1 p-5 text-center">
          <p className="text-[15px] font-semibold text-foreground">
            {sameDay(selectedDay, today) ? "Hoy tenés la agenda libre" : "Sin reuniones ese día"}
          </p>
          {sameDay(selectedDay, today) && <p className="text-sm text-neutral-500">Buen momento para escribirle a tus leads nuevos.</p>}
          {sameDay(selectedDay, today) && (
            <Link href="/dashboard" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent-600 px-5 text-sm font-medium text-[var(--on-accent)] hover:bg-accent-700">
              <Send className="size-4" aria-hidden="true" />
              Ver siguiente contacto
            </Link>
          )}
        </section>
      )}

      {selectedCitas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-foreground">{sameDay(selectedDay, today) ? "Hoy" : "Ese día"}</h2>
          {selectedCitas.map((c) => (
            <CitaRow key={c.id} cita={c} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-foreground">Próximas reuniones</h2>
        {citas === null && <p className="text-sm text-neutral-500">Cargando…</p>}
        {citas !== null && upcoming.length === 0 && <p className="text-sm text-neutral-500">No tenés reuniones próximas.</p>}
        {upcoming.slice(0, 8).map((c) => (
          <CitaRow key={c.id} cita={c} showDay />
        ))}
      </section>
    </div>
  );
}

function CitaRow({ cita, showDay = false }: { cita: AgendaAppointment; showDay?: boolean }) {
  const date = new Date(cita.startTime);
  const dayLabel = `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()}`;
  return (
    <article className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-border-default bg-surface-1 py-3.5 pr-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-accent-500" aria-hidden="true" />
      <div className="flex w-14 shrink-0 flex-col">
        <span className="font-display text-[18px] leading-tight font-semibold tabular-nums text-foreground">{formatTime(cita.startTime)}</span>
        {showDay && <span className="text-xs text-neutral-500">{dayLabel}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">{cita.contactName ?? "Sin contacto"}</p>
        <p className="truncate text-sm text-neutral-500">{cita.subject ?? cita.appointmentType ?? "Reunión"}</p>
      </div>
    </article>
  );
}
