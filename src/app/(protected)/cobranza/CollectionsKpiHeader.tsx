"use client";

import { Wallet, CheckCircle2, AlertTriangle, CalendarClock, Coins, Gauge, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { CollectionsKpis } from "@/lib/collections/queries";
import { formatCurrency } from "@/lib/utils/format";
import type { CollectionsQuickFilter } from "./collectionsFilters";

function KpiTile({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  sublabel,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <span className={cn("flex size-10 items-center justify-center rounded-full", iconBg, iconColor)}>{icon}</span>
      <div>
        <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
        {sublabel && <p className="text-xs text-neutral-400">{sublabel}</p>}
      </div>
    </>
  );

  if (!onClick) {
    return <Card className="flex flex-col gap-3">{content}</Card>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-surface-1 p-5 text-left shadow-[var(--elevation-sm)] transition-all duration-150 ease-out hover:shadow-[var(--elevation-md)]",
        active && "ring-2 ring-accent-500",
      )}
    >
      {content}
    </button>
  );
}

/** 8 tarjetas pedidas explícitamente en el spec — 4 clickeables (filtran la
 * lista) y 4 informativas (agregados que no mapean a un subconjunto de filas
 * filtrable con sentido, mismo criterio que PoliciesKpiHeader). */
export function CollectionsKpiHeader({
  kpis,
  quickFilter,
  onQuickFilterChange,
}: {
  kpis: CollectionsKpis;
  quickFilter: CollectionsQuickFilter;
  onQuickFilterChange: (next: CollectionsQuickFilter) => void;
}) {
  function toggle(next: CollectionsQuickFilter) {
    onQuickFilterChange(quickFilter === next ? "all" : next);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={<Wallet className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-info-bg"
        iconColor="text-info-strong"
        value={formatCurrency(kpis.totalPending)}
        label="Total pendiente"
        onClick={() => toggle("pending")}
        active={quickFilter === "pending"}
      />
      <KpiTile
        icon={<CheckCircle2 className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-success-bg"
        iconColor="text-success-strong"
        value={formatCurrency(kpis.collectedThisMonth)}
        label="Cobrado este mes"
        onClick={() => toggle("paidThisMonth")}
        active={quickFilter === "paidThisMonth"}
      />
      <KpiTile
        icon={<AlertTriangle className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-error-bg"
        iconColor="text-error-strong"
        value={formatCurrency(kpis.overdueAmount)}
        label="Vencido"
        sublabel={`${kpis.overdueCount} cobro${kpis.overdueCount === 1 ? "" : "s"}`}
        onClick={() => toggle("overdue")}
        active={quickFilter === "overdue"}
      />
      <KpiTile
        icon={<CalendarClock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-warning-bg"
        iconColor="text-warning-strong"
        value={formatCurrency(kpis.upcoming7Amount)}
        label="Próximos 7 días"
        sublabel={`${kpis.upcoming7Count} cobro${kpis.upcoming7Count === 1 ? "" : "s"}`}
        onClick={() => toggle("upcoming")}
        active={quickFilter === "upcoming"}
      />
      <KpiTile
        icon={<Landmark className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.monthlyPremium)}
        label="Prima mensual"
      />
      <KpiTile
        icon={<Landmark className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.annualPremium)}
        label="Prima anual"
      />
      <KpiTile
        icon={<Gauge className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={`${kpis.effectiveCollectionRatePct}%`}
        label="Tasa efectiva de cobro"
      />
      <KpiTile
        icon={<Coins className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-green-100"
        iconColor="text-green-700"
        value={formatCurrency(kpis.commissionGenerated)}
        label="Comisión generada"
      />
    </div>
  );
}
