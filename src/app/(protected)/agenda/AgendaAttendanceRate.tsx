"use client";

import { CalendarCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AgendaPerformance } from "@/lib/agenda/queries";

interface Rate {
  rate: number;
  realizadas: number;
  total: number;
}

/** Asistencia = realizada + venta (la cita efectivamente ocurrió) sobre el
 * total de citas del período — no_show/cancelada nunca cuentan como
 * asistencia, agendada/confirmada todavía están pendientes de resolverse. */
function attendanceRate(totals: AgendaPerformance["totals"] | null | undefined): Rate | null {
  if (!totals || totals.total === 0) return null;
  const realizadas = totals.realizada + totals.venta;
  return { rate: Math.round((realizadas / totals.total) * 100), realizadas, total: totals.total };
}

/** "Tasa de asistencia" — reemplaza "Próximas citas" (redundante con la
 * agenda principal, que ya las muestra). Mismo `data` que
 * AgendaEstadoDonut/AgendaTipoBars, así que respeta el mismo período de
 * "KPIs Automáticos" sin lógica propia de fechas. */
export function AgendaAttendanceRate({ data }: { data: AgendaPerformance | null }) {
  const current = attendanceRate(data?.totals);
  const previous = attendanceRate(data?.previousTotals);
  const trend = current && previous ? current.rate - previous.rate : null;

  return (
    <Card>
      <CardHeader title="Tasa de asistencia" />
      {!current ? (
        <EmptyState icon={CalendarCheck} title="Sin citas todavía" description="Todavía no hay citas sincronizadas para este período." />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-1">
          <div
            className="relative flex size-[132px] shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(var(--color-success) ${current.rate * 3.6}deg, var(--surface-2) 0deg)` }}
          >
            <div className="flex size-[104px] items-center justify-center rounded-full bg-surface-1">
              <span className="font-mono text-2xl font-semibold text-foreground">{current.rate}%</span>
            </div>
          </div>
          <p className="text-[13px] text-neutral-500">
            {current.realizadas} realizadas / {current.total} agendadas
          </p>
          {trend !== null && (
            <p className={`text-[12px] font-medium ${trend >= 0 ? "text-success-strong" : "text-error-strong"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}% vs. período anterior
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
