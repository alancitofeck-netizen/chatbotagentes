import { TrendingDown, TrendingUp, Users, MessageCircle, CalendarClock, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { DashboardKpis } from "@/lib/dashboard/queries";

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

export function KpiCards({ kpis }: { kpis: DashboardKpis }) {
  const delta = kpis.leadsYesterday === 0 ? null : Math.round(((kpis.leadsToday - kpis.leadsYesterday) / kpis.leadsYesterday) * 100);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <div className="flex items-start justify-between">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <Users className="size-[18px]" aria-hidden="true" />
          </span>
          {delta !== null && (
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
        <p className="mt-3 font-mono text-[28px] font-semibold leading-none text-foreground">{kpis.leadsToday}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">Leads hoy</p>
      </Card>

      <Card>
        <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <MessageCircle className="size-[18px]" aria-hidden="true" />
        </span>
        <p className="mt-3 font-mono text-[28px] font-semibold leading-none text-foreground">
          {kpis.conversationsActive}
        </p>
        <p className="mt-1.5 text-[13px] text-neutral-500">Conversaciones activas</p>
        <div className="mt-3 flex gap-4 text-xs text-neutral-500">
          <span>
            <span className="font-semibold text-foreground">{kpis.conversationsUnread}</span> no leídas
          </span>
          <span>
            <span className="font-semibold text-foreground">{kpis.conversationsWaiting}</span> esperando
          </span>
        </div>
      </Card>

      <Card>
        <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <CalendarClock className="size-[18px]" aria-hidden="true" />
        </span>
        <p className="mt-3 font-mono text-[28px] font-semibold leading-none text-foreground">{kpis.meetingsToday}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">Reuniones hoy</p>
        <p className="mt-3 truncate text-xs text-neutral-500">
          {kpis.nextMeeting
            ? `Próxima: ${kpis.nextMeeting.subject ?? kpis.nextMeeting.contactName} · ${formatRelativeTime(kpis.nextMeeting.startTime)}`
            : "Sin próximas reuniones"}
        </p>
      </Card>

      <Card>
        <span className="flex size-9 items-center justify-center rounded-full bg-success-bg text-success-strong">
          <DollarSign className="size-[18px]" aria-hidden="true" />
        </span>
        <p className="mt-3 font-mono text-[28px] font-semibold leading-none text-foreground">
          {formatCurrency(kpis.salesThisMonth)}
        </p>
        <p className="mt-1.5 text-[13px] text-neutral-500">Ventas del mes</p>
        <p className="mt-3 text-xs text-neutral-500">
          <span className="font-semibold text-foreground">{kpis.conversionRate}%</span> conversión
        </p>
      </Card>
    </div>
  );
}
