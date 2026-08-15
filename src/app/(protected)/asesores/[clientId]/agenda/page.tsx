import type { Metadata } from "next";
import { CalendarDays, CalendarClock, CheckCircle2, XCircle, Ban, RotateCcw } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientAppointments, getClientProfile } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getAdvisorAgendaAppointments } from "@/lib/agenda/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatTile } from "../../StatTile";
import { AppointmentsTable } from "../../AppointmentsTable";
import { FuenteDonutChart } from "../../FuenteDonutChart";
import { WeekdayBarChart } from "../../WeekdayBarChart";
import { bucketByDay, monthOverMonthDelta } from "@/lib/clients/statsHelpers";
import { MiniCalendar } from "./MiniCalendar";
import { SyncedAgendaCard } from "./SyncedAgendaCard";

export const metadata: Metadata = { title: "Agenda — Cliente — Growth Link" };

export default async function ClientAgendaPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const client = await getClientProfile(workspaceId, clientId);
  if (!client) return null;
  // "Setter"/"Responsable" es gente del EQUIPO DEL ASESOR (su propio
  // workspace real), no el tuyo — ver plan "Agenda en vivo".
  const [appointments, members, syncedCitas] = await Promise.all([
    getClientAppointments(workspaceId, clientId),
    getWorkspaceMembers(client.linkedWorkspaceId ?? workspaceId),
    getAdvisorAgendaAppointments(workspaceId, clientId),
  ]);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));

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
          <MiniCalendar appointments={appointments} now={now} />
          <Card>
            <CardHeader title="Citas programadas" />
            <AppointmentsTable appointments={appointments} nameById={nameById} clientId={clientId} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <SyncedAgendaCard citas={syncedCitas} />

          <Card>
            <CardHeader title="Resumen de agenda" />
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-neutral-500">Total citas</span>
                <span className="font-medium text-foreground">{appointments.length}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-neutral-500">Este mes</span>
                <span className="font-medium text-foreground">{thisMonth.length}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-neutral-500">Show rate</span>
                <span className="font-medium text-foreground">{appointments.length > 0 ? Math.round((shows.length / appointments.length) * 100) : 0}%</span>
              </li>
            </ul>
          </Card>

          <FuenteDonutChart title="Citas por fuente" appointments={appointments} />
          <WeekdayBarChart appointments={appointments} />

          <Card>
            <CardHeader title="Calendly" />
            {client.calendlyUrl ? (
              <div className="flex flex-col gap-2">
                <a href={client.calendlyUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-accent-600 hover:underline">
                  {client.calendlyUrl}
                </a>
                <a
                  href={client.calendlyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-1.5 rounded-full border border-border-default px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
                >
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  Abrir Calendly
                </a>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Sin Calendly cargado.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
