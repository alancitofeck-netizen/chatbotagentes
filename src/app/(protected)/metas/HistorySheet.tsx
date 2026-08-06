"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { History } from "lucide-react";
import { getGoalsHistoryAction } from "@/lib/goals/actions";
import type { SalesGoal } from "@/lib/goals/queries";
import { GOAL_METRIC_META, GOAL_STATUS_LABEL } from "@/lib/goals/constants";
import { formatCurrency } from "@/lib/utils/format";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMetricValue(value: number, unit: "count" | "currency" | "percent"): string {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percent") return `${value}%`;
  return new Intl.NumberFormat("es").format(value);
}

export function HistorySheet({ onClose }: { onClose: () => void }) {
  const [goals, setGoals] = useState<SalesGoal[] | null>(null);

  useEffect(() => {
    getGoalsHistoryAction().then(setGoals);
  }, []);

  return (
    <Sheet open onClose={onClose} title="Historial de objetivos">
      <div className="flex flex-col gap-3 p-5">
        {!goals ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : goals.length === 0 ? (
          <EmptyState icon={History} title="Sin objetivos cerrados todavía" description="Los objetivos cumplidos o vencidos van a aparecer acá." />
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.map((g) => {
              const meta = GOAL_METRIC_META[g.metricKey];
              return (
                <li key={g.id} className="flex flex-col gap-1 rounded-lg border border-border-default p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{g.name}</p>
                    <Badge variant={g.status === "completed" ? "success" : "error"}>{GOAL_STATUS_LABEL[g.status]}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {meta.label} · Objetivo {formatMetricValue(g.targetValue, meta.unit)} · {formatDate(g.periodStart)} – {formatDate(g.periodEnd)}
                  </p>
                  {g.memberName && <p className="text-xs text-neutral-400">{g.memberName}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
