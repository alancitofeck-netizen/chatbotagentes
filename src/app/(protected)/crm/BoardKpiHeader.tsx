"use client";

import type { ReactNode } from "react";
import { Briefcase, UserPlus, CalendarClock, FileText, Award, Wallet, Percent, TrendingUp, TrendingDown, XCircle } from "lucide-react";
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
  // En celular cada indicador es una tarjeta de 2 columnas (ícono + etiqueta
  // arriba, número grande abajo, como el prototipo); desde `md` vuelve a la
  // franja compacta de siempre (ícono al costado).
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border-default bg-surface-1 p-3 md:flex-1 md:flex-row md:items-center md:gap-2.5 md:rounded-lg md:px-3 md:py-2.5">
      <div className="flex min-w-0 items-start gap-2 md:contents">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>{icon}</span>
        <p className="min-w-0 text-[12.5px] leading-tight text-neutral-500 md:hidden">{label}</p>
      </div>
      <div className="min-w-0 md:flex-1">
        <p className="hidden truncate text-[11.5px] leading-tight text-neutral-500 md:block">{label}</p>
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <p className="font-mono text-[22px] font-semibold leading-tight text-foreground md:text-[17px]">{value}</p>
          {deltaPct !== undefined && <DeltaBadge pct={deltaPct} />}
        </div>
        {footnote && <p className="truncate text-[10px] text-neutral-400">{footnote}</p>}
      </div>
    </div>
  );
}

/** Fila compacta de KPIs (los 7 de siempre más "Perdidas") — mismos 7 números y mismo cálculo que antes
 * (BoardKpis, src/lib/crm/queries.ts), solo una presentación mucho más
 * densa (una sola franja delgada en vez de tarjetas grandes) para que el
 * pipeline/leads sean lo primero que ocupe espacio en pantalla, no las
 * métricas. Solo 3 KPIs (Nuevos leads, Ventas cerradas, Conversión) tienen
 * una base mes-a-mes real para calcular variación — el resto muestra solo
 * el valor actual en vez de una tendencia inventada. */
export function BoardKpiHeader({ kpis }: { kpis: BoardKpis }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
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
      <KpiTile
        icon={<XCircle className="size-4" aria-hidden="true" />}
        iconBg="bg-[var(--color-error-bg)]"
        iconColor="text-[var(--color-error-strong)]"
        value={String(kpis.lostTotal)}
        label="Perdidas"
      />
    </div>
  );
}
