import { CalendarDays, CalendarClock, CheckCircle2, XCircle, Ban, RotateCcw, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatTile } from "../../StatTile";
import { AppointmentsTable } from "../../AppointmentsTable";
import { FuenteDonutChart } from "../../FuenteDonutChart";
import { bucketByDay, monthOverMonthDelta } from "@/lib/clients/statsHelpers";
import { CampaignBarChart } from "./CampaignBarChart";
import { ContractNotesPanel } from "../contrato/ContractNotesPanel";
import type { ClientAppointment, ClientNote, ClientSetterPerformance } from "@/lib/clients/queries";

/** Contenido original de la pestaña Operación (previo al rediseño de
 * sub-pestañas) — sin cambios de lógica, solo reubicado bajo el sub-tab
 * "Citas" del nuevo OperacionShell. */
export function CitasSubTab({
  clientId,
  appointments,
  setters,
  notes,
  nameById,
}: {
  clientId: string;
  appointments: ClientAppointment[];
  setters: ClientSetterPerformance[];
  notes: ClientNote[];
  nameById: Map<string, string>;
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = appointments.filter((a) => new Date(a.startTime) >= monthStart);
  const shows = appointments.filter((a) => a.attended === true);
  const noShows = appointments.filter((a) => a.attended === false);
  const cancelled = appointments.filter((a) => a.status === "cancelled");
  const rescheduled = appointments.filter((a) => a.status === "rescheduled");

  const allDates = appointments.map((a) => a.startTime);
  const showDates = shows.map((a) => a.startTime);
  const noShowDates = noShows.map((a) => a.startTime);
  const cancelledDates = cancelled.map((a) => a.startTime);
  const rescheduledDates = rescheduled.map((a) => a.startTime);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={CalendarDays} label="Total citas" value={String(appointments.length)} sparklineData={bucketByDay(allDates, 14)} deltaPct={monthOverMonthDelta(allDates)} />
        <StatTile icon={CalendarClock} label="Este mes" value={String(thisMonth.length)} />
        <StatTile
          icon={CheckCircle2}
          label="Show"
          value={String(shows.length)}
          sparklineData={bucketByDay(showDates, 14)}
          deltaPct={monthOverMonthDelta(showDates)}
          color="var(--color-success-strong)"
        />
        <StatTile
          icon={XCircle}
          label="No-show"
          value={String(noShows.length)}
          sparklineData={bucketByDay(noShowDates, 14)}
          deltaPct={monthOverMonthDelta(noShowDates)}
          color="var(--color-error-strong)"
        />
        <StatTile icon={Ban} label="Canceladas" value={String(cancelled.length)} sparklineData={bucketByDay(cancelledDates, 14)} deltaPct={monthOverMonthDelta(cancelledDates)} />
        <StatTile
          icon={RotateCcw}
          label="Reagendadas"
          value={String(rescheduled.length)}
          sparklineData={bucketByDay(rescheduledDates, 14)}
          deltaPct={monthOverMonthDelta(rescheduledDates)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Citas" />
            <AppointmentsTable appointments={appointments} nameById={nameById} clientId={clientId} searchable />
          </Card>
          <ContractNotesPanel clientId={clientId} initialNotes={notes} nameById={nameById} title="Observaciones internas" />
        </div>

        <div className="flex flex-col gap-4">
          <FuenteDonutChart title="Fuentes de citas" appointments={appointments} />
          <CampaignBarChart appointments={appointments} />

          <Card>
            <CardHeader title="Setters que más generan" />
            {setters.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin citas asignadas a un setter todavía.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {setters.map((s) => (
                  <li key={s.setterId} className="flex items-center gap-2.5 text-sm">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
                      <Users className="size-3.5" aria-hidden="true" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-foreground">{nameById.get(s.setterId) ?? "—"}</span>
                    <span className="font-mono text-xs text-neutral-500">{s.citas} citas · {s.showRate}% show</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
