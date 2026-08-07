import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CalendarCheck2, UserCheck, Filter, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import type { DashboardHomeKpis } from "@/lib/dashboard/homeQueries";

function Tile({ icon, label, value, footer, footerTone }: { icon: React.ReactNode; label: string; value: string; footer?: React.ReactNode; footerTone?: "success" | "error" | "neutral" }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px] text-neutral-500">
        <span className="flex size-7 items-center justify-center rounded-md bg-surface-2">{icon}</span>
        {label}
      </div>
      <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
      {footer && (
        <p
          className={cn(
            "text-xs",
            footerTone === "success" ? "text-success-strong" : footerTone === "error" ? "text-error-strong font-medium" : "text-neutral-400",
          )}
        >
          {footer}
        </p>
      )}
    </Card>
  );
}

export function HomeKpiCards({ kpis }: { kpis: DashboardHomeKpis }) {
  const delta = kpis.citasAgendadas.deltaPct;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        icon={<CalendarCheck2 className="size-4 text-accent-600" aria-hidden="true" />}
        label="Citas agendadas"
        value={String(kpis.citasAgendadas.count)}
        footerTone={delta === null ? "neutral" : delta >= 0 ? "success" : "error"}
        footer={
          delta === null ? (
            "Sin período previo para comparar"
          ) : (
            <span className="inline-flex items-center gap-1">
              {delta >= 0 ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
              {Math.abs(delta)}% vs. período previo
            </span>
          )
        }
      />
      <Tile
        icon={<UserCheck className="size-4 text-success-strong" aria-hidden="true" />}
        label="Se presentaron"
        value={String(kpis.sePresentaron.attendedCount)}
        footerTone="success"
        footer={
          kpis.sePresentaron.attendanceRatePct === null
            ? "Todavía sin citas marcadas"
            : `${kpis.sePresentaron.attendanceRatePct}% de asistencia`
        }
      />
      <Tile
        icon={<Filter className="size-4 text-info-strong" aria-hidden="true" />}
        label="Embudo activo"
        value={formatCurrency(kpis.embudoActivo.amount, kpis.embudoActivo.currency)}
        footer={`${kpis.embudoActivo.count} póliza${kpis.embudoActivo.count === 1 ? "" : "s"} en proceso`}
      />
      <Tile
        icon={<AlertTriangle className="size-4 text-error-strong" aria-hidden="true" />}
        label="Cartera en riesgo"
        value={String(kpis.carteraEnRiesgo.count)}
        footerTone="error"
        footer={
          kpis.carteraEnRiesgo.count > 0 ? (
            <Link href="/cobranza" className="underline hover:no-underline">
              Revisar cobranza
            </Link>
          ) : (
            "Sin cobros vencidos"
          )
        }
      />
    </div>
  );
}
