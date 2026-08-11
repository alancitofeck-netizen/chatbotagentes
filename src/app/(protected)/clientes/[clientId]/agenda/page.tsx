import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientAppointments } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Agenda — Cliente — Growth Link" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const PROVIDER_LABEL: Record<string, string> = {
  internal: "Interno",
  highlevel: "HighLevel",
  google: "Google",
  calendly: "Calendly",
};

/** Reutiliza bookings.client_id (0125) — nada se carga a mano. "Resultado"
 * sale de bookings.attended (show/no-show) hasta que exista un campo más
 * rico — ver plan, sección Alertas + Health Score. */
export default async function ClientAgendaPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const [appointments, members] = await Promise.all([getClientAppointments(workspaceId, clientId), getWorkspaceMembers(workspaceId)]);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = appointments.filter((a) => new Date(a.startTime) >= monthStart);
  const shows = appointments.filter((a) => a.attended === true).length;
  const noShows = appointments.filter((a) => a.attended === false).length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const rescheduled = appointments.filter((a) => a.status === "rescheduled").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={CalendarDays} label="Total citas" value={String(appointments.length)} />
        <MetricCard icon={CalendarDays} label="Citas este mes" value={String(thisMonth.length)} />
        <MetricCard icon={CalendarDays} label="Show" value={String(shows)} />
        <MetricCard icon={CalendarDays} label="No-show" value={String(noShows)} />
        <MetricCard icon={CalendarDays} label="Canceladas" value={String(cancelled)} />
        <MetricCard icon={CalendarDays} label="Reagendadas" value={String(rescheduled)} />
      </div>

      <Card>
        <CardHeader title="Citas" />
        {appointments.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Sin citas" description="Todavía no hay citas vinculadas a este cliente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Lead</th>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Fuente</th>
                  <th className="pb-2 font-medium">Setter</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className="border-t border-border-default">
                    <td className="py-2 text-foreground">{a.contactName ?? "—"}</td>
                    <td className="py-2 text-neutral-500">{formatDateTime(a.startTime)}</td>
                    <td className="py-2 text-neutral-500">{PROVIDER_LABEL[a.provider] ?? a.provider}</td>
                    <td className="py-2 text-neutral-500">{a.ownerId ? (nameById.get(a.ownerId) ?? "—") : "—"}</td>
                    <td className="py-2 text-neutral-500">{a.status}</td>
                    <td className="py-2 text-neutral-500">{a.attended === true ? "Show" : a.attended === false ? "No-show" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
