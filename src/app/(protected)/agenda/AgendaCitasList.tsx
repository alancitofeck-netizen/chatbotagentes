"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarDays } from "lucide-react";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { AgendaCitaRow } from "./AgendaCitaRow";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function weekdayCapitalized(d: Date) {
  const label = d.toLocaleDateString("es-MX", { weekday: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Las 3 secciones del rediseño de Agenda — Necesitan resultado (vencidas, siguen "Agendada" o
 * "Propuesta") / Hoy / Próximas — sobre las citas ya cargadas (mismo set que alimenta la franja de
 * embudo, sin fetch aparte). Compartida por escritorio (AgendaShell) y mobile (AgendaMobileHome). */
export function AgendaCitasList({
  citas,
  selectedId,
  onSelect,
  onAgendarClick,
}: {
  citas: AgendaAppointment[];
  selectedId: string | null;
  onSelect: (cita: AgendaAppointment) => void;
  onAgendarClick: () => void;
}) {
  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const live = citas.filter((c) => !c.deletedInSheet).sort((a, b) => a.startTime.localeCompare(b.startTime));

    const necesitanResultado: AgendaAppointment[] = [];
    const hoy: AgendaAppointment[] = [];
    const proximas: AgendaAppointment[] = [];
    for (const c of live) {
      const start = new Date(c.startTime);
      if (start < today) {
        if (c.estadoCita === "agendada" || c.estadoCita === "propuesta") necesitanResultado.push(c);
        continue;
      }
      if (start < tomorrow) hoy.push(c);
      else proximas.push(c);
    }
    return { necesitanResultado, hoy, proximas, todayLabel: weekdayCapitalized(today) + " " + today.getDate() };
  }, [citas]);

  if (citas.filter((c) => !c.deletedInSheet).length === 0) {
    return <EmptyState icon={CalendarDays} title="Sin citas en este rango" description="No hay citas agendadas para el período seleccionado." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.necesitanResultado.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[14px] font-semibold text-foreground">Necesitan resultado</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-bg px-1.5 text-[11px] font-semibold text-warning-strong">{groups.necesitanResultado.length}</span>
            <span className="text-[12.5px] text-neutral-500">Ya pasaron y siguen como agendadas</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border-default bg-surface-1">
            {groups.necesitanResultado.map((c) => (
              <AgendaCitaRow key={c.id} cita={c} selected={c.id === selectedId} onSelect={() => onSelect(c)} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-[14px] font-semibold text-foreground">Hoy · {groups.todayLabel}</h3>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-2 px-1.5 text-[11px] font-semibold text-neutral-600">{groups.hoy.length}</span>
        </div>
        {groups.hoy.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border-strong px-4 py-3 text-[13px] text-neutral-500">
            No hay citas para hoy.
            <button type="button" onClick={onAgendarClick} className="font-medium text-accent-600 hover:text-accent-700">
              Agendar una cita
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-default bg-surface-1">
            {groups.hoy.map((c) => (
              <AgendaCitaRow key={c.id} cita={c} selected={c.id === selectedId} onSelect={() => onSelect(c)} />
            ))}
          </div>
        )}
      </section>

      {groups.proximas.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[14px] font-semibold text-foreground">Próximas</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-2 px-1.5 text-[11px] font-semibold text-neutral-600">{groups.proximas.length}</span>
            <span className="text-[12.5px] text-neutral-500">Esta semana</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border-default bg-surface-1">
            {groups.proximas.map((c) => (
              <AgendaCitaRow key={c.id} cita={c} selected={c.id === selectedId} onSelect={() => onSelect(c)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
