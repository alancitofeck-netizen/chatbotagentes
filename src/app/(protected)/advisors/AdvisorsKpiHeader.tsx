"use client";

import { ShieldCheck, UserPlus, Wallet, Coins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AdvisorsKpis } from "@/lib/advisors/queries";
import { formatCurrency } from "@/lib/utils/format";

function KpiTile({ icon, iconBg, iconColor, value, label }: { icon: React.ReactNode; iconBg: string; iconColor: string; value: string; label: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <span className={`flex size-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>{icon}</span>
      <div>
        <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
      </div>
    </Card>
  );
}

export function AdvisorsKpiHeader({ kpis }: { kpis: AdvisorsKpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={<ShieldCheck className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.totalPolicies)}
        label="Total de pólizas"
      />
      <KpiTile
        icon={<UserPlus className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
        value={String(kpis.newThisMonth)}
        label="Nuevas este mes"
      />
      <KpiTile
        icon={<Coins className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-green-100"
        iconColor="text-green-700"
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
