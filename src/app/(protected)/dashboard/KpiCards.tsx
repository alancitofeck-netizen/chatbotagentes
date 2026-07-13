"use client";

import type { ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { TrendingDown, TrendingUp, Users, MessageCircle, CalendarClock, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ActivityPoint, DashboardKpis } from "@/lib/dashboard/queries";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatRelativeTime(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) return diffMin <= 0 ? "ahora" : `en ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  return diffH > 0 ? `en ${diffH} h` : `hace ${Math.abs(diffH)} h`;
}

function Sparkline({ data, dataKey, color }: { data: ActivityPoint[]; dataKey: keyof ActivityPoint; color: string }) {
  return (
    <div className="h-10 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  delta,
  sparklineColor,
  sparklineData,
  sparklineKey,
  footnote,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  delta?: number | null;
  sparklineColor: string;
  sparklineData: ActivityPoint[];
  sparklineKey: keyof ActivityPoint;
  footnote?: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className={`flex size-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
          {icon}
        </span>
        {delta !== undefined && delta !== null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${delta >= 0 ? "text-success-strong" : "text-error-strong"}`}
          >
            {delta >= 0 ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
          <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
          {footnote && <p className="mt-1 truncate text-xs text-neutral-500">{footnote}</p>}
        </div>
        <Sparkline data={sparklineData} dataKey={sparklineKey} color={sparklineColor} />
      </div>
    </Card>
  );
}

export function KpiCards({ kpis, activity }: { kpis: DashboardKpis; activity: ActivityPoint[] }) {
  const delta = kpis.leadsYesterday === 0 ? null : Math.round(((kpis.leadsToday - kpis.leadsYesterday) / kpis.leadsYesterday) * 100);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<Users className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.leadsToday)}
        label="Leads hoy"
        delta={delta}
        sparklineColor="var(--color-accent-500)"
        sparklineData={activity}
        sparklineKey="leads"
      />

      <KpiCard
        icon={<MessageCircle className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
        value={String(kpis.conversationsActive)}
        label="Conversaciones activas"
        sparklineColor="#3B82F6"
        sparklineData={activity}
        sparklineKey="mensajes"
        footnote={`${kpis.conversationsUnread} no leídas · ${kpis.conversationsWaiting} esperando`}
      />

      <KpiCard
        icon={<CalendarClock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-orange-100"
        iconColor="text-orange-700"
        value={String(kpis.meetingsToday)}
        label="Reuniones hoy"
        sparklineColor="#F5A524"
        sparklineData={activity}
        sparklineKey="reuniones"
        footnote={
          kpis.nextMeeting
            ? `Próxima: ${kpis.nextMeeting.subject ?? kpis.nextMeeting.contactName} · ${formatRelativeTime(kpis.nextMeeting.startTime)}`
            : "Sin próximas reuniones"
        }
      />

      <KpiCard
        icon={<DollarSign className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-green-100"
        iconColor="text-green-700"
        value={formatCurrency(kpis.salesThisMonth)}
        label="Ventas del mes"
        sparklineColor="#2E9563"
        sparklineData={activity}
        sparklineKey="ventas"
        footnote={`${kpis.conversionRate}% conversión`}
      />
    </div>
  );
}
