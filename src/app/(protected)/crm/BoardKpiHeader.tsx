"use client";

import type { ReactNode } from "react";
import { Briefcase, UserPlus, CalendarClock, FileText, Award, Wallet, Percent, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { BoardKpis } from "@/lib/crm/queries";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-semibold ${pct >= 0 ? "text-success-strong" : "text-error-strong"}`}
    >
      {pct >= 0 ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
      {pct >= 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function KpiTile({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  deltaPct,
  footnote,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  deltaPct?: number | null;
  footnote?: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className={`flex size-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>{icon}</span>
        {deltaPct !== undefined && <DeltaBadge pct={deltaPct} />}
      </div>
      <div>
        <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
        {footnote && <p className="mt-1 truncate text-xs text-neutral-500">{footnote}</p>}
      </div>
    </Card>
  );
}

/** 7 KPI tiles requested for the board header. Only 3 (Nuevos leads, Ventas
 * cerradas, Conversión) have a real month-over-month baseline to compute a
 * delta from (see BoardKpis in src/lib/crm/queries.ts) — the rest show the
 * current value only rather than a fabricated trend. */
export function BoardKpiHeader({ kpis }: { kpis: BoardKpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={<Briefcase className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.totalOpportunities)}
        label="Total de oportunidades"
      />
      <KpiTile
        icon={<UserPlus className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
        value={String(kpis.newLeadsThisMonth)}
        label="Nuevos leads (mes)"
        deltaPct={kpis.newLeadsDeltaPct}
      />
      <KpiTile
        icon={<CalendarClock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-orange-100"
        iconColor="text-orange-700"
        value={String(kpis.meetingsScheduled)}
        label="Reuniones agendadas"
        footnote="Próximas, todo el workspace"
      />
      <KpiTile
        icon={<FileText className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-yellow-100"
        iconColor="text-yellow-700"
        value={String(kpis.proposalsSent)}
        label="Propuestas enviadas"
      />
      <KpiTile
        icon={<Award className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-green-100"
        iconColor="text-green-700"
        value={String(kpis.dealsWonThisMonth)}
        label="Ventas cerradas (mes)"
        deltaPct={kpis.dealsWonDeltaPct}
      />
      <KpiTile
        icon={<Wallet className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.totalPipelineValue)}
        label="Valor total del pipeline"
      />
      <KpiTile
        icon={<Percent className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={`${kpis.monthlyConversionRate}%`}
        label="Conversión del mes"
        deltaPct={kpis.monthlyConversionDeltaPct}
      />
    </div>
  );
}
