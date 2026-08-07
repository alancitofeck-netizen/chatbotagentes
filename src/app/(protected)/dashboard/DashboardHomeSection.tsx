"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { DashboardHomeData, DashboardPeriod } from "@/lib/dashboard/homeQueries";
import { getDashboardHomeAction } from "./actions";
import { HomeKpiCards } from "./HomeKpiCards";
import { SalesEfficacyPanel } from "./SalesEfficacyPanel";
import { GoalsProgressPanel } from "./GoalsProgressPanel";
import { formatCurrency } from "@/lib/utils/format";

const PERIOD_LABEL: Record<DashboardPeriod, string> = { day: "Día", week: "Semana", month: "Mes", year: "Año" };
const PERIODS: DashboardPeriod[] = ["day", "week", "month", "year"];

/** No repite el saludo — ExecutiveSummary (más arriba en page.tsx) ya dice
 * "Buenos días/tardes/noches, {nombre}"; acá solo el título de esta sección
 * + el selector de período + el resumen de agenda del día. Tampoco un
 * gráfico de actividad propio — ActivityChart (más abajo en la página) ya
 * cubre esa vista; duplicarlo con otro gráfico de barras al lado se sentía
 * repetido (ver el feedback del usuario). */
export function DashboardHomeSection({ initialData, initialPeriod }: { initialData: DashboardHomeData; initialPeriod: DashboardPeriod }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  function handlePeriodChange(next: DashboardPeriod) {
    setPeriod(next);
    startTransition(async () => {
      const fresh = await getDashboardHomeAction(next);
      setData(fresh);
    });
  }

  const { greeting: g } = data;
  const summaryParts = [
    `${g.appointmentsToday} cita${g.appointmentsToday === 1 ? "" : "s"} agendada${g.appointmentsToday === 1 ? "" : "s"} hoy`,
    `${g.pendingTasksToday} pendiente${g.pendingTasksToday === 1 ? "" : "s"}`,
    g.collectionsThisWeekAmount > 0 ? `${formatCurrency(g.collectionsThisWeekAmount)} por cobrar esta semana` : null,
  ].filter(Boolean);

  return (
    <div className={cn("flex flex-col gap-4", isPending && "opacity-60 transition-opacity duration-200")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-foreground">Tu día de hoy</h2>
          <p className="text-sm text-neutral-500">{summaryParts.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full bg-surface-2 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
                period === p ? "bg-accent-500 text-white" : "text-neutral-500 hover:text-foreground",
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <HomeKpiCards kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesEfficacyPanel eficacia={data.eficaciaVentas} />
        <GoalsProgressPanel goals={data.goals} />
      </div>
    </div>
  );
}

export function DashboardHomeCardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children}
    </Card>
  );
}
