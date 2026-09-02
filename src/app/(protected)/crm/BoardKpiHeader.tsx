"use client";

import type { ReactNode } from "react";
import { Briefcase, UserPlus, CalendarClock, FileText, Award, Wallet, Percent, TrendingUp, TrendingDown } from "lucide-react";
import type { BoardKpis } from "@/lib/crm/queries";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${pct >= 0 ? "text-success-strong" : "text-error-strong"}`}>
      {pct >= 0 ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
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
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border-default bg-surface-1 px-3 py-2.5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] leading-tight text-neutral-500">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="font-mono text-[17px] font-semibold leading-tight text-foreground">{value}</p>
          {deltaPct !== undefined && <DeltaBadge pct={deltaPct} />}
        </div>
        {footnote && <p className="truncate text-[10px] text-neutral-400">{footnote}</p>}
      </div>
    </div>
  );
}

/** Fila compacta de 7 KPIs — mismos 7 números y mismo cálculo que antes
 * (BoardKpis, src/lib/crm/queries.ts), solo una presentación mucho más
 * densa (una sola franja delgada en vez de tarjetas grandes) para que el
 * pipeline/leads sean lo primero que ocupe espacio en pantalla, no las
 * métricas. Solo 3 KPIs (Nuevos leads, Ventas cerradas, Conversión) tienen
 * una base mes-a-mes real para calcular variación — el resto muestra solo
 * el valor actual en vez de una tendencia inventada. */
export function BoardKpiHeader({ kpis }: { kpis: BoardKpis }) {
  return (
    <div className="flex flex-wrap gap-2">
      <KpiTile
        icon={<Briefcase className="size-4" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.totalOpportunities)}
        label="Oportunidades"
      />
      <KpiTile
        icon={<UserPlus className="size-4" aria-hidden="true" />}
        iconBg="bg-[var(--color-chart-3)]/15"
        iconColor="text-[var(--color-chart-3)]"
        value={String(kpis.newLeadsThisMonth)}
        label="Nuevos leads"
        deltaPct={kpis.newLeadsDeltaPct}
      />
      <KpiTile
        icon={<CalendarClock className="size-4" aria-hidden="true" />}
        iconBg="bg-[var(--color-chart-2)]/15"
        iconColor="text-[var(--color-chart-2)]"
        value={String(kpis.meetingsScheduled)}
        label="Reuniones"
      />
      <KpiTile
        icon={<FileText className="size-4" aria-hidden="true" />}
        iconBg="bg-[var(--color-chart-4)]/15"
        iconColor="text-[var(--color-chart-4)]"
        value={String(kpis.proposalsSent)}
        label="Propuestas"
      />
      <KpiTile
        icon={<Award className="size-4" aria-hidden="true" />}
        iconBg="bg-[var(--color-success-bg)]"
        iconColor="text-[var(--color-success-strong)]"
        value={String(kpis.dealsWonThisMonth)}
        label="Ventas cerradas"
        deltaPct={kpis.dealsWonDeltaPct}
      />
      <KpiTile
        icon={<Wallet className="size-4" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.totalPipelineValue)}
        label="Pipeline"
      />
      <KpiTile
        icon={<Percent className="size-4" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={`${kpis.monthlyConversionRate}%`}
        label="Conversión"
        deltaPct={kpis.monthlyConversionDeltaPct}
      />
    </div>
  );
}
