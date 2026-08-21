"use client";

import { useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  Send,
  MessageSquare,
  MessagesSquare,
  XCircle,
  Repeat,
  CalendarClock,
  CalendarPlus,
  Star,
  ChevronLeft,
  ChevronRight,
  Download,
  Scale,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AgencyAdvisorOption, AgencyKpiEntryRow, AgencyTeamOption } from "@/lib/kpis/agencyPerformance";
import { totalsFromEntries, acceptanceRate, responseRate, conversationRate, bookingRate, conversionRate, agendas, type KpiTotals } from "@/lib/kpis/formulas";
import { deltaPct } from "@/lib/clients/statsHelpers";
import {
  currentPeriodMonth,
  currentWeekNumber,
  previousPeriodMonth,
  nextPeriodMonth,
  previousWeek,
  nextWeek,
  monthLabel,
  weekLabel,
  groupBySetter,
} from "@/lib/kpis/periodHelpers";
import { determineRendimiento } from "@/lib/kpis/aiManager/analysis";
import { StatTile } from "../StatTile";
import { PerformanceRankingTable, type RankingRow } from "./PerformanceRankingTable";
import { SetterDetailSheet } from "./SetterDetailSheet";
import { AgentComparisonSheet } from "./AgentComparisonSheet";
import { AiManagerPanel } from "./AiManagerPanel";

type PeriodType = "week" | "month";

const KPI_CARD_DEFS: { key: keyof KpiTotals; label: string; icon: typeof Users }[] = [
  { key: "conexion", label: "Conexiones", icon: Users },
  { key: "conexionesAceptadas", label: "Aceptadas", icon: UserCheck },
  { key: "primerMensajeEnviado", label: "Primer mensaje enviado", icon: Send },
  { key: "respuestasPrimerMensaje", label: "Respuestas", icon: MessageSquare },
  { key: "enConversacion", label: "En conversación", icon: MessagesSquare },
  { key: "noLeInteresa", label: "No le interesa", icon: XCircle },
  { key: "seguimientoConversacion", label: "Seguimiento conversación", icon: Repeat },
  { key: "seguimientoAgenda", label: "Seguimiento agenda", icon: CalendarClock },
  { key: "agendaManual", label: "Agenda manual", icon: CalendarPlus },
  { key: "calificadas", label: "Calificadas", icon: Star },
];

export function PerformanceShell({ advisors, teams, entries }: { advisors: AgencyAdvisorOption[]; teams: AgencyTeamOption[]; entries: AgencyKpiEntryRow[] }) {
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [periodMonth, setPeriodMonth] = useState(currentPeriodMonth());
  const [weekNumber, setWeekNumber] = useState(currentWeekNumber());
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [setterFilter, setSetterFilter] = useState("");
  const [selectedSetterId, setSelectedSetterId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const base = useMemo(
    () => entries.filter((e) => (!advisorFilter || e.advisorWorkspaceId === advisorFilter) && (!teamFilter || e.teamId === teamFilter) && (!setterFilter || e.setterId === setterFilter)),
    [entries, advisorFilter, teamFilter, setterFilter],
  );

  const setterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) seen.set(e.setterId, e.setterName);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const currentEntries = useMemo(
    () => base.filter((e) => e.periodMonth === periodMonth && (periodType === "month" || e.weekNumber === weekNumber)),
    [base, periodMonth, weekNumber, periodType],
  );
  const previousEntries = useMemo(() => {
    const previousPeriod = periodType === "week" ? previousWeek(periodMonth, weekNumber) : { periodMonth: previousPeriodMonth(periodMonth), weekNumber: 0 };
    return base.filter((e) => e.periodMonth === previousPeriod.periodMonth && (periodType === "month" || e.weekNumber === previousPeriod.weekNumber));
  }, [base, periodMonth, weekNumber, periodType]);

  const teamTotals = totalsFromEntries(currentEntries);
  const previousTeamTotals = totalsFromEntries(previousEntries);

  const ranking: RankingRow[] = useMemo(() => {
    const bySetter = groupBySetter(currentEntries);
    return [...bySetter.entries()]
      .map(([setterId, bucket]) => {
        const totals = totalsFromEntries(bucket.rows);
        return {
          setterId,
          setterName: bucket.setterName,
          advisorName: bucket.advisorName,
          totals,
          acceptanceRate: acceptanceRate(totals),
          responseRate: responseRate(totals),
          conversationRate: conversationRate(totals),
          bookingRate: bookingRate(totals),
          conversionRate: conversionRate(totals),
          agendas: agendas(totals),
          status: determineRendimiento(totals, teamTotals),
        };
      })
      .sort((a, b) => b.conversionRate - a.conversionRate);
  }, [currentEntries, teamTotals]);

  const periodLabel = periodType === "week" ? weekLabel(periodMonth, weekNumber) : monthLabel(periodMonth);
  const shows = ranking.length;

  function goToPreviousPeriod() {
    if (periodType === "week") {
      const p = previousWeek(periodMonth, weekNumber);
      setPeriodMonth(p.periodMonth);
      setWeekNumber(p.weekNumber);
    } else {
      setPeriodMonth(previousPeriodMonth(periodMonth));
    }
  }
  function goToNextPeriod() {
    if (periodType === "week") {
      const n = nextWeek(periodMonth, weekNumber);
      setPeriodMonth(n.periodMonth);
      setWeekNumber(n.weekNumber);
    } else {
      setPeriodMonth(nextPeriodMonth(periodMonth));
    }
  }

  function toggleCompare(setterId: string) {
    setCompareIds((prev) => (prev.includes(setterId) ? prev.filter((id) => id !== setterId) : prev.length >= 5 ? prev : [...prev, setterId]));
  }

  function handleExport() {
    const header = ["Setter", "Asesor", "Conexión", "Aceptadas", "Primer mensaje", "Respuestas", "En conversación", "No le interesa", "Agendas", "Calificadas", "Acceptance Rate", "Response Rate", "Conversation Rate", "Booking Rate", "Calif. Rate"];
    const rows = ranking.map((r) => [
      r.setterName,
      r.advisorName,
      r.totals.conexion,
      r.totals.conexionesAceptadas,
      r.totals.primerMensajeEnviado,
      r.totals.respuestasPrimerMensaje,
      r.totals.enConversacion,
      r.totals.noLeInteresa,
      r.agendas,
      r.totals.calificadas,
      `${r.acceptanceRate}%`,
      `${r.responseRate}%`,
      `${r.conversationRate}%`,
      `${r.bookingRate}%`,
      `${r.conversionRate}%`,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `performance-${periodType === "week" ? `semana-${weekNumber}` : "mensual"}-${periodMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectedSetter = selectedSetterId ? ranking.find((r) => r.setterId === selectedSetterId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Período</span>
          <div className="flex gap-1 rounded-full bg-surface-2 p-1">
            {(["week", "month"] as PeriodType[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodType(p)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  periodType === p ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"
                }`}
              >
                {p === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">{periodType === "week" ? "Semana" : "Mes"}</span>
          <div className="flex items-center gap-1 rounded-md border border-border-default px-1.5 py-1">
            <button type="button" onClick={goToPreviousPeriod} className="flex size-7 items-center justify-center rounded text-neutral-500 hover:bg-surface-2 hover:text-foreground">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="min-w-[180px] text-center text-[13px] font-medium text-foreground capitalize">{periodLabel}</span>
            <button type="button" onClick={goToNextPeriod} className="flex size-7 items-center justify-center rounded text-neutral-500 hover:bg-surface-2 hover:text-foreground">
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <Select label="Asesor" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {advisors.map((a) => (
            <option key={a.workspaceId} value={a.workspaceId}>
              {a.name}
            </option>
          ))}
        </Select>

        <Select label="Equipo" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>

        <Select label="Setter" value={setterFilter} onChange={(e) => setSetterFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {setterOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {compareIds.length > 1 && (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-accent-500 bg-accent-500/10 px-3.5 py-2 text-[13px] font-medium text-accent-700 hover:bg-accent-500/20"
            >
              <Scale className="size-4" aria-hidden="true" />
              Comparar ({compareIds.length})
            </button>
          )}
          <button type="button" onClick={handleExport} className="flex items-center gap-1.5 rounded-full border border-border-default px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2">
            <Download className="size-4" aria-hidden="true" />
            Exportar
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Users} title="Sin datos de Performance todavía" description="Ningún asesor tiene setters con hojas de Google Sheets conectadas y sincronizadas." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {KPI_CARD_DEFS.map((c) => (
                <StatTile key={c.key} icon={c.icon} label={c.label} value={String(teamTotals[c.key])} deltaPct={deltaPct(teamTotals[c.key], previousTeamTotals[c.key])} />
              ))}
            </div>

            <Card>
              <CardHeader title="Performance de equipo" action={<span className="text-xs text-neutral-500">Mostrando {shows} agente{shows === 1 ? "" : "s"}</span>} />
              {ranking.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin datos para este período/filtros.</p>
              ) : (
                <PerformanceRankingTable rows={ranking} compareIds={compareIds} onToggleCompare={toggleCompare} onSelect={setSelectedSetterId} />
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <AiManagerPanel periodMonth={periodMonth} weekNumber={periodType === "week" ? weekNumber : undefined} />
            <Card>
              <CardHeader title="Resumen del período" />
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-neutral-500">Agentes activos</span>
                  <span className="font-medium text-foreground">{shows}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-neutral-500">Calif. Rate del equipo</span>
                  <span className="font-medium text-foreground">{conversionRate(teamTotals)}%</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-neutral-500">Agendas del equipo</span>
                  <span className="font-medium text-foreground">{agendas(teamTotals)}</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {selectedSetter && (
        <SetterDetailSheet
          key={selectedSetter.setterId}
          setterName={selectedSetter.setterName}
          advisorName={selectedSetter.advisorName}
          entries={entries.filter((e) => e.setterId === selectedSetter.setterId)}
          currentTotals={selectedSetter.totals}
          previousTotals={totalsFromEntries(previousEntries.filter((e) => e.setterId === selectedSetter.setterId))}
          status={selectedSetter.status}
          onClose={() => setSelectedSetterId(null)}
        />
      )}

      {compareOpen && (
        <AgentComparisonSheet
          rows={ranking.filter((r) => compareIds.includes(r.setterId))}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        />
      )}
    </div>
  );
}
