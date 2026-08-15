"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Users2, UserRound, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMonday, addDays } from "@/lib/calendar/week";
import { getAgendaAppointmentsAction } from "@/lib/agenda/actions";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { CitaCard } from "./CitaCard";

type ViewKey = "hoy" | "manana" | "semana" | "mes";
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "manana", label: "Mañana" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
];

function rangeFor(view: ViewKey, today: Date): { start: string; end: string } {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (view === "hoy") return { start: base.toISOString(), end: addDays(base, 1).toISOString() };
  if (view === "manana") return { start: addDays(base, 1).toISOString(), end: addDays(base, 2).toISOString() };
  if (view === "semana") {
    const monday = getMonday(base);
    return { start: monday.toISOString(), end: addDays(monday, 7).toISOString() };
  }
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { start: monthStart.toISOString(), end: monthEnd.toISOString() };
}

function formatDayGroup(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" });
}

/** Vista operativa de Agenda — Hoy/Mañana/Semana/Mes + Mis citas/Equipo,
 * agregada cross-tenant sobre las citas reales de todos los asesores
 * gestionados (ver src/lib/agenda/queries.ts). Un 'agent' (setter) solo
 * recibe sus propias citas del server (isManager=false esconde el toggle
 * de scope porque no hay nada que alternar). */
export function AgendaShell({ isManager }: { isManager: boolean }) {
  const [view, setView] = useState<ViewKey>("hoy");
  const [citas, setCitas] = useState<AgendaAppointment[] | null>(null);
  const [loading, startTransition] = useTransition();

  const range = useMemo(() => rangeFor(view, new Date()), [view]);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const data = await getAgendaAppointmentsAction(range);
      if (!cancelled) setCitas(data);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const grouped = useMemo(() => {
    const map = new Map<string, AgendaAppointment[]>();
    for (const cita of citas ?? []) {
      const key = formatDayGroup(cita.startTime);
      const list = map.get(key) ?? [];
      list.push(cita);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [citas]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                view === v.key ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {isManager && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
            <Users2 className="size-3.5" aria-hidden="true" />
            Vista de equipo — todas las citas gestionadas
          </span>
        )}
        {!isManager && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-500">
            <UserRound className="size-3.5" aria-hidden="true" />
            Mis citas
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Cargando agenda…
        </div>
      ) : !citas || citas.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin citas en este rango" description="No hay citas agendadas para el período seleccionado." />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([day, dayCitas]) => (
            <div key={day} className="flex flex-col gap-3">
              <p className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase">{day}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {dayCitas.map((cita) => (
                  <CitaCard key={cita.id} cita={cita} canEditEstado />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
