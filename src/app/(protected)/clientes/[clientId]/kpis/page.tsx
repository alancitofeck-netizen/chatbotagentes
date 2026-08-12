import type { Metadata } from "next";
import { CalendarDays, CalendarClock, CheckCircle2, XCircle, Ban, RotateCcw } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import {
  getClientAppointments,
  getClientAudienceFunnel,
  getClientConversationDates,
  getClientPolicies,
  getClientSetterPerformance,
} from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatTile } from "../../StatTile";
import { FuenteDonutChart } from "../../FuenteDonutChart";
import { bucketByDay, deltaPct, monthCounts, monthOverMonthDelta, monthSums } from "@/lib/clients/statsHelpers";
import { MonthComparisonLineChart } from "./MonthComparisonLineChart";
import { AudienceFunnelChart } from "./AudienceFunnelChart";

export const metadata: Metadata = { title: "KPIs — Cliente — Growth Link" };

function DeltaCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-neutral-400">—</span>;
  return <span className={pct >= 0 ? "text-success-strong" : "text-error-strong"}>{pct >= 0 ? "+" : ""}{pct}%</span>;
}

export default async function ClientKpisPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const [appointments, policies, members, funnel, setters, conversationDates] = await Promise.all([
    getClientAppointments(workspaceId, clientId),
    getClientPolicies(workspaceId, clientId),
    getWorkspaceMembers(workspaceId),
    getClientAudienceFunnel(workspaceId, clientId),
    getClientSetterPerformance(workspaceId, clientId),
    getClientConversationDates(workspaceId, clientId),
  ]);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = appointments.filter((a) => new Date(a.startTime) >= monthStart);
  const lastMonthAppointments = appointments.filter((a) => new Date(a.startTime) >= lastMonthStart && new Date(a.startTime) < monthStart);
  const shows = appointments.filter((a) => a.attended === true);
  const noShows = appointments.filter((a) => a.attended === false);
  const cancelled = appointments.filter((a) => a.status === "cancelled");
  const rescheduled = appointments.filter((a) => a.status === "rescheduled");

  const allDates = appointments.map((a) => a.startTime);
  const showDates = shows.map((a) => a.startTime);
  const noShowDates = noShows.map((a) => a.startTime);
  const cancelledDates = cancelled.map((a) => a.startTime);
  const rescheduledDates = rescheduled.map((a) => a.startTime);
  const policyDates = policies.filter((p) => p.issueDate).map((p) => p.issueDate as string);

  // Comparativa mensual
  const citasMonth = monthCounts(allDates);
  const showsMonth = monthCounts(showDates);
  const showRateThisMonth = citasMonth.thisMonth > 0 ? Math.round((showsMonth.thisMonth / citasMonth.thisMonth) * 100) : 0;
  const showRateLastMonth = citasMonth.lastMonth > 0 ? Math.round((showsMonth.lastMonth / citasMonth.lastMonth) * 100) : 0;
  const polizasMonth = monthCounts(policyDates);
  const valorMonth = monthSums(policies.filter((p) => p.issueDate).map((p) => ({ date: p.issueDate as string, value: p.commissionAmount ?? 0 })));
  const conversacionesMonth = monthCounts(conversationDates);

  const comparativa = [
    { label: "Citas generadas", thisMonth: citasMonth.thisMonth, lastMonth: citasMonth.lastMonth, format: (v: number) => String(v), pct: deltaPct(citasMonth.thisMonth, citasMonth.lastMonth) },
    { label: "Show rate", thisMonth: showRateThisMonth, lastMonth: showRateLastMonth, format: (v: number) => `${v}%`, pct: deltaPct(showRateThisMonth, showRateLastMonth) },
    { label: "Pólizas vendidas", thisMonth: polizasMonth.thisMonth, lastMonth: polizasMonth.lastMonth, format: (v: number) => String(v), pct: deltaPct(polizasMonth.thisMonth, polizasMonth.lastMonth) },
    { label: "Valor generado", thisMonth: valorMonth.thisMonth, lastMonth: valorMonth.lastMonth, format: (v: number) => `USD ${v.toLocaleString("es-MX")}`, pct: deltaPct(valorMonth.thisMonth, valorMonth.lastMonth) },
    { label: "Conversaciones", thisMonth: conversacionesMonth.thisMonth, lastMonth: conversacionesMonth.lastMonth, format: (v: number) => String(v), pct: deltaPct(conversacionesMonth.thisMonth, conversacionesMonth.lastMonth) },
  ];

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

      <MonthComparisonLineChart thisMonthDates={thisMonth.map((a) => a.startTime)} lastMonthDates={lastMonthAppointments.map((a) => a.startTime)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AudienceFunnelChart funnel={funnel} />
        <FuenteDonutChart title="Distribución de fuentes" appointments={appointments} />
      </div>

      <Card>
        <CardHeader title="Rendimiento por setter" />
        {setters.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin citas asignadas a un setter todavía.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Setter</th>
                <th className="py-2 pr-3 font-medium">Citas</th>
                <th className="py-2 pr-3 font-medium">Show rate</th>
                <th className="py-2 pr-3 font-medium">Pólizas</th>
              </tr>
            </thead>
            <tbody>
              {setters.map((s) => (
                <tr key={s.setterId} className="border-b border-border-subtle last:border-0">
                  <td className="py-2 pr-3 text-foreground">{nameById.get(s.setterId) ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-500">{s.citas}</td>
                  <td className="py-2 pr-3 text-neutral-500">{s.showRate}%</td>
                  <td className="py-2 pr-3 text-neutral-500">{s.polizas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <CardHeader title="Comparativa mensual" />
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-default text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">Métrica</th>
              <th className="py-2 pr-3 font-medium">Este mes</th>
              <th className="py-2 pr-3 font-medium">Mes anterior</th>
              <th className="py-2 pr-3 font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {comparativa.map((row) => (
              <tr key={row.label} className="border-b border-border-subtle last:border-0">
                <td className="py-2 pr-3 text-foreground">{row.label}</td>
                <td className="py-2 pr-3 text-neutral-500">{row.format(row.thisMonth)}</td>
                <td className="py-2 pr-3 text-neutral-500">{row.format(row.lastMonth)}</td>
                <td className="py-2 pr-3 font-medium">
                  <DeltaCell pct={row.pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
