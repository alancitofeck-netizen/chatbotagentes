"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { DashboardHomeData, DashboardPeriod } from "@/lib/dashboard/homeQueries";
import { getDashboardHomeAction } from "./actions";
import { HomeKpiCards } from "./HomeKpiCards";
import { MonthlyActivityChart } from "./MonthlyActivityChart";
import { SalesEfficacyPanel } from "./SalesEfficacyPanel";
import { TodayTasksPanel } from "./TodayTasksPanel";
import { GoalsProgressPanel } from "./GoalsProgressPanel";
import { formatCurrency } from "@/lib/utils/format";

const PERIOD_LABEL: Record<DashboardPeriod, string> = { day: "Día", week: "Semana", month: "Mes", year: "Año" };
const PERIODS: DashboardPeriod[] = ["day", "week", "month", "year"];

function greetingPrefix(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardHomeSection({ firstName, initialData, initialPeriod }: { firstName: string; initialData: DashboardHomeData; initialPeriod: DashboardPeriod }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  // Se calcula en el cliente (no en el server, que en Vercel corre en UTC) —
  // así "Buenos días"/"Buenas tardes" refleja la hora real del asesor, no
  // la del datacenter.
  const [greeting] = useState(() => greetingPrefix(new Date().getHours()));

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
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
            {greeting}, {firstName}
          </p>
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Tu día de hoy</h1>
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
        <MonthlyActivityChart data={data.monthlyActivity} />
        <SalesEfficacyPanel eficacia={data.eficaciaVentas} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodayTasksPanel tasks={data.pendingTasksToday} />
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
