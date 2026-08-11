"use client";

import { ShieldCheck, UserPlus, CalendarClock, AlertTriangle, Coins, Wallet, Layers, Building2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { PolicyDashboardKpis } from "@/lib/policies/queries";
import type { PolicyQuickFilter } from "@/lib/policies/boardFilters";
import { formatCurrency } from "@/lib/utils/format";

function KpiTile({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  /** Only the count-based tiles with an unambiguous single-filter meaning
   * are clickable (Total/Activas/Renuevan 30 días/Vencidas) — premium
   * totals and distinct-entity counts (clientes asegurados, aseguradoras
   * activas, valor de cartera) are aggregates, not a filterable subset of
   * rows, so they stay informational-only tiles without an onClick. */
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <span className={cn("flex size-10 items-center justify-center rounded-full", iconBg, iconColor)}>{icon}</span>
      <div>
        <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
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

export function PoliciesKpiHeader({
  kpis,
  quickFilter,
  onQuickFilterChange,
}: {
  kpis: PolicyDashboardKpis;
  quickFilter: PolicyQuickFilter;
  onQuickFilterChange: (next: PolicyQuickFilter) => void;
}) {
  function toggle(next: PolicyQuickFilter) {
    onQuickFilterChange(quickFilter === next ? "all" : next);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={<Layers className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-neutral-200 dark:bg-neutral-800"
        iconColor="text-neutral-700 dark:text-neutral-300"
        value={String(kpis.totalPolicies)}
        label="Total de pólizas"
        onClick={() => toggle("all")}
        active={quickFilter === "all"}
      />
      <KpiTile
        icon={<ShieldCheck className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.totalActive)}
        label="Pólizas activas"
        onClick={() => toggle("active")}
        active={quickFilter === "active"}
      />
      <KpiTile
        icon={<UserPlus className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-[var(--color-info-bg)]"
        iconColor="text-[var(--color-info-strong)]"
        value={String(kpis.newThisMonth)}
        label="Nuevas este mes"
      />
      <KpiTile
        icon={<CalendarClock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-warning-bg"
        iconColor="text-warning-strong"
        value={String(kpis.renewalsUpcoming30)}
        label="Renuevan en 30 días"
        onClick={() => toggle("renewals30")}
        active={quickFilter === "renewals30"}
      />
      <KpiTile
        icon={<AlertTriangle className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-error-bg"
        iconColor="text-error-strong"
        value={String(kpis.renewalsOverdue)}
        label="Vencidas"
        onClick={() => toggle("overdue")}
        active={quickFilter === "overdue"}
      />
      <KpiTile
        icon={<Wallet className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.portfolioValue)}
        label="Valor de cartera"
      />
      <KpiTile
        icon={<Wallet className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.monthlyPremium)}
        label="Prima mensual"
      />
      <KpiTile
        icon={<Wallet className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.annualPremium)}
        label="Prima anual"
      />
      <KpiTile
        icon={<Coins className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-[var(--color-success-bg)]"
        iconColor="text-[var(--color-success-strong)]"
        value={formatCurrency(kpis.commissionPending)}
        label="Comisión pendiente"
      />
      <KpiTile
        icon={<UserPlus className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.insuredClients)}
        label="Clientes asegurados"
      />
      <KpiTile
        icon={<Building2 className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-[var(--color-info-bg)]"
        iconColor="text-[var(--color-info-strong)]"
        value={String(kpis.activeInsurers)}
        label="Aseguradoras activas"
      />
      <KpiTile
        icon={<ShieldCheck className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-[var(--color-info-bg)]"
        iconColor="text-[var(--color-info-strong)]"
        value={kpis.renewalRate !== null ? `${Math.round(kpis.renewalRate * 100)}%` : "—"}
        label="Tasa de renovación"
      />
    </div>
  );
}
