import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";

function formatWhen(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}, ${date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Citas que vienen de la hoja de Google Sheets conectada a este asesor
 * (agenda_appointments, ver src/lib/advisorSync) — de solo lectura, no
 * reemplaza "Citas programadas" (bookings/Google Calendar, arriba en esta
 * misma página): son dos fuentes distintas, esta se suma para que las
 * citas de Agenda también sean visibles acá. */
export function SyncedAgendaCard({ citas }: { citas: AgendaAppointment[] }) {
  return (
    <Card>
      <CardHeader
        title="Agenda (Google Sheets)"
        action={
          <Link href="/agenda" className="text-[12px] text-accent-600 hover:underline">
            Ver módulo Agenda
          </Link>
        }
      />
      {citas.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="Sin citas sincronizadas" description="Todavía no hay citas sincronizadas desde la hoja de este asesor." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-default">
          {citas.map((cita) => {
            const meta = ESTADO_CITA_META[cita.estadoCita];
            return (
              <li key={cita.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{cita.contactName ?? "Sin nombre"}</p>
                  <p className="truncate text-[12px] text-neutral-500">
                    {formatWhen(cita.startTime)} · {cita.appointmentType ?? "Cita"}
                    {cita.setterName && ` · Setter: ${cita.setterName}`}
                  </p>
                </div>
                <Badge variant={meta.variant} className="shrink-0">
                  {meta.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
