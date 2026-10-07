"use client";

import { ShieldCheck, UserPlus, Wallet, Coins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AdvisorsKpis } from "@/lib/advisors/queries";
import { formatCurrency } from "@/lib/utils/format";

function KpiTile({ icon, iconBg, iconColor, value, label }: { icon: React.ReactNode; iconBg: string; iconColor: string; value: string; label: string }) {
  return (
    <Card className="flex flex-col gap-2 max-sm:p-3 sm:gap-3">
      <span className={`flex size-8 items-center justify-center rounded-full sm:size-10 ${iconBg} ${iconColor}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate font-mono text-xl font-semibold leading-none text-foreground sm:text-2xl">{value}</p>
        <p className="mt-1.5 text-[12.5px] leading-tight text-neutral-500 sm:text-[13px]">{label}</p>
      </div>
    </Card>
  );
}

export function AdvisorsKpiHeader({ kpis }: { kpis: AdvisorsKpis }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      <KpiTile
        icon={<ShieldCheck className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.totalPolicies)}
        label="Total de prospectos"
      />
      <KpiTile
        icon={<UserPlus className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-[var(--color-info-bg)]"
        iconColor="text-[var(--color-info-strong)]"
        value={String(kpis.newThisMonth)}
        label="Nuevas este mes"
      />
      <KpiTile
        icon={<Coins className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-[var(--color-success-bg)]"
        iconColor="text-[var(--color-success-strong)]"
        value={formatCurrency(kpis.totalCommissionThisMonth)}
        label="Comisión del mes"
      />
      <KpiTile
        icon={<Wallet className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.totalPortfolioValue)}
        label="Valor de cartera"
      />
    </div>
  );
}
