import type { Metadata } from "next";
import { CalendarDays, CalendarClock, CheckCircle2, XCircle, Ban, RotateCcw } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import {
  getClientAppointments,
  getClientAudienceFunnel,
  getClientConversationDates,
  getClientPolicies,
  getClientProfile,
  getClientSetterPerformance,
} from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getKpiEntries, getKpiSetterSheets, hasAnyKpiSetterSheet, totalsFromEntries, type KpiEntryRow } from "@/lib/kpis/queries";
import { agendas, conversionRate, estadoLevel, ESTADO_LABEL, type KpiTotals } from "@/lib/kpis/formulas";
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

const KPI_SHEET_CARD_DEFS: { key: keyof KpiTotals; label: string }[] = [
  { key: "conexion", label: "Conexión" },
  { key: "conexionesAceptadas", label: "Conexiones aceptadas" },
  { key: "respuestasPrimerMensaje", label: "Respuestas al primer mensaje" },
  { key: "primerMensajeEnviado", label: "Primer mensaje enviado" },
  { key: "enConversacion", label: "En conversación" },
  { key: "noLeInteresa", label: "No le interesa" },
  { key: "seguimientoConversacion", label: "Seguimiento conversación" },
  { key: "seguimientoAgenda", label: "Seguimiento agenda" },
  { key: "agendaManual", label: "Agenda manual" },
  { key: "calificadas", label: "Calificadas" },
];

function currentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Ranking por setter de la hoja de KPIs — mismo cálculo que KpisSection.tsx
 * (módulo /kpis del propio workspace), reimplementado server-side acá porque
 * ese componente es client-side y sus Server Actions resuelven contra el
 * workspace ACTIVO del que llama (requireActiveWorkspace), no contra
 * linkedWorkspaceId — no sirve para leer el de OTRO workspace. */
function buildKpiRanking(entries: KpiEntryRow[]) {
  const bySetter = new Map<string, { setterName: string; rows: KpiEntryRow[] }>();
  for (const e of entries) {
    const bucket = bySetter.get(e.setterId) ?? { setterName: e.setterName, rows: [] };
    bucket.rows.push(e);
    bySetter.set(e.setterId, bucket);
  }
  return [...bySetter.entries()]
    .map(([id, { setterName, rows }]) => {
      const t = totalsFromEntries(rows);
      const conv = conversionRate(t);
      return { setterId: id, setterName, conexion: t.conexion, agendas: agendas(t), calificadas: t.calificadas, conversion: conv, estado: estadoLevel(conv) };
    })
    .sort((a, b) => b.conversion - a.conversion);
}

export default async function ClientKpisPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const client = await getClientProfile(workspaceId, clientId);
  if (!client) return null;
  const periodMonth = currentMonthIso();
  const linkedWorkspaceId = client.linkedWorkspaceId;
  const [appointments, policies, members, funnel, setters, conversationDates, kpiHasSheet, kpiSetterSheets, kpiEntries] = await Promise.all([
    getClientAppointments(workspaceId, clientId),
    getClientPolicies(workspaceId, clientId),
    getWorkspaceMembers(linkedWorkspaceId ?? workspaceId),
    getClientAudienceFunnel(workspaceId, clientId),
    getClientSetterPerformance(workspaceId, clientId),
    getClientConversationDates(workspaceId, clientId),
    linkedWorkspaceId ? hasAnyKpiSetterSheet(linkedWorkspaceId) : Promise.resolve(false),
    linkedWorkspaceId ? getKpiSetterSheets(linkedWorkspaceId) : Promise.resolve([]),
    linkedWorkspaceId ? getKpiEntries(linkedWorkspaceId, { periodMonth }) : Promise.resolve([]),
  ]);
  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const kpiTotals = totalsFromEntries(kpiEntries);
  const kpiConversion = conversionRate(kpiTotals);
  const kpiAgendasCount = agendas(kpiTotals);
  const kpiRanking = buildKpiRanking(kpiEntries);

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

      <Card>
        <CardHeader title={`KPIs de Google Sheets — ${monthLabel(periodMonth)}`} />
        {!kpiHasSheet ? (
          <p className="text-sm text-neutral-500">
            Este asesor todavía no conectó su hoja de KPIs (módulo KPIs → Configuración → Integraciones, dentro de su propio workspace).
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {KPI_SHEET_CARD_DEFS.map((c) => (
                <div key={c.key} className="rounded-lg border border-border-default bg-surface-1 p-3">
                  <p className="font-mono text-[20px] font-semibold leading-none text-foreground">{kpiTotals[c.key]}</p>
                  <p className="mt-1.5 text-[13px] text-neutral-500">{c.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border-default bg-surface-1 p-3">
                <p className="font-mono text-[22px] font-semibold leading-none text-foreground">{kpiAgendasCount}</p>
                <p className="mt-1.5 text-[13px] text-neutral-500">Agendas (seguimiento agenda + agenda manual)</p>
              </div>
              <div className="rounded-lg border border-border-default bg-surface-1 p-3">
                <p className="font-mono text-[22px] font-semibold leading-none text-foreground">{kpiConversion}%</p>
                <p className="mt-1.5 text-[13px] text-neutral-500">Conversión (calificadas / conexiones aceptadas)</p>
              </div>
            </div>

            {kpiRanking.length > 1 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-xs text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Setter</th>
                      <th className="py-2 pr-3 font-medium">Conexión</th>
                      <th className="py-2 pr-3 font-medium">Agendas</th>
                      <th className="py-2 pr-3 font-medium">Calificadas</th>
                      <th className="py-2 pr-3 font-medium">Conversión</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiRanking.map((r) => (
                      <tr key={r.setterId} className="border-b border-border-subtle last:border-0">
                        <td className="py-2 pr-3 text-foreground">{r.setterName}</td>
                        <td className="py-2 pr-3 text-neutral-500">{r.conexion}</td>
                        <td className="py-2 pr-3 text-neutral-500">{r.agendas}</td>
                        <td className="py-2 pr-3 text-neutral-500">{r.calificadas}</td>
                        <td className="py-2 pr-3 text-neutral-500">{r.conversion}%</td>
                        <td className="py-2 pr-3 text-neutral-500">{ESTADO_LABEL[r.estado]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-neutral-500">Hojas conectadas</p>
              {kpiSetterSheets.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm">
                  <span className="text-foreground">{s.displayName}</span>
                  <span className="text-neutral-500">
                    {!s.spreadsheetId
                      ? "Sin hoja conectada"
                      : s.lastSyncStatus === "error"
                        ? `Error: ${s.lastSyncError ?? "desconocido"}`
                        : s.lastSyncedAt
                          ? `Sincronizado ${new Date(s.lastSyncedAt).toLocaleString("es-MX")} · ${s.rowCount} filas`
                          : "Nunca sincronizado"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

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
