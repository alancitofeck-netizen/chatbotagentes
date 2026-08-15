"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarClock } from "lucide-react";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** Próximas citas — las N más cercanas a partir de ahora (nunca las del
 * rango seleccionado arriba: eso te dejaría sin nada acá si estás mirando
 * "Hoy" y ya pasaron todas), mismos datos reales de agenda_appointments. */
export function AgendaUpcomingList({ citas }: { citas: AgendaAppointment[] }) {
  return (
    <Card>
      <CardHeader title="Próximas citas" />
      {citas.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Sin próximas citas" description="No hay citas agendadas en los próximos días." />
      ) : (
        <ul className="flex flex-col gap-3">
          {citas.map((cita) => {
            const date = new Date(cita.startTime);
            const meta = ESTADO_CITA_META[cita.estadoCita];
            return (
              <li key={cita.id} className="flex items-start gap-3">
                <div className="flex w-11 shrink-0 flex-col items-center rounded-md bg-surface-2 py-1.5 text-center">
                  <span className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">{date.toLocaleDateString("es-MX", { month: "short" })}</span>
                  <span className="text-base font-semibold text-foreground">{date.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {formatTime(cita.startTime)} · {cita.contactName ?? "Sin nombre"}
                    </p>
                    <Badge variant={meta.variant} className="shrink-0">
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="truncate text-[12px] text-neutral-500">
                    {cita.appointmentType ?? "Cita"} · Setter: {cita.setterName ?? "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
