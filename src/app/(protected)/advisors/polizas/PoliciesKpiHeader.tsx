"use client";

import { ShieldCheck, UserPlus, CalendarClock, AlertTriangle, Coins, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PolicyDashboardKpis } from "@/lib/policies/queries";
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

export function PoliciesKpiHeader({ kpis }: { kpis: PolicyDashboardKpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={<ShieldCheck className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.totalActive)}
        label="Pólizas activas"
      />
      <KpiTile
        icon={<UserPlus className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
        value={String(kpis.newThisMonth)}
        label="Nuevas este mes"
      />
      <KpiTile
        icon={<CalendarClock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-warning-bg"
        iconColor="text-warning-strong"
        value={String(kpis.renewalsUpcoming30)}
        label="Renuevan en 30 días"
      />
      <KpiTile
        icon={<AlertTriangle className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-error-bg"
        iconColor="text-error-strong"
        value={String(kpis.renewalsOverdue)}
        label="Vencidas"
      />
      <KpiTile
        icon={<Wallet className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={formatCurrency(kpis.portfolioValue)}
        label="Valor de cartera"
      />
      <KpiTile
        icon={<Coins className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-green-100"
        iconColor="text-green-700"
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
        icon={<ShieldCheck className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
        value={kpis.renewalRate !== null ? `${Math.round(kpis.renewalRate * 100)}%` : "—"}
        label="Tasa de renovación"
      />
    </div>
  );
}
