"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Trophy } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRankingAction } from "@/lib/goals/actions";
import type { RankingEntry } from "@/lib/goals/queries";
import { GOAL_METRIC_KEYS, GOAL_METRIC_META, type GoalMetricKey } from "@/lib/goals/constants";
import { cn } from "@/lib/utils/cn";

const MEDAL_COLOR = ["text-warning-strong", "text-neutral-400", "text-orange-600"];

/** Ranking = asesores con un objetivo INDIVIDUAL activo para la métrica
 * elegida, ordenados por % de cumplimiento contra SU propio objetivo — no
 * un leaderboard de valores crudos sin contexto (ver la nota en
 * goals/queries.ts). */
export function RankingList({ currentMemberId }: { currentMemberId: string | null }) {
  const [metricKey, setMetricKey] = useState<GoalMetricKey>("premium_issued");
  const [entries, setEntries] = useState<RankingEntry[] | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setEntries(null));
    getRankingAction(metricKey).then(setEntries);
  }, [metricKey]);

  return (
    <Card>
      <CardHeader
        title="Ranking entre asesores"
        action={
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value as GoalMetricKey)}
            aria-label="Métrica del ranking"
            className="rounded-sm border border-border-strong bg-surface-1 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          >
            {GOAL_METRIC_KEYS.map((k) => (
              <option key={k} value={k}>
                {GOAL_METRIC_META[k].label}
              </option>
            ))}
          </select>
        }
      />

      {!entries ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Trophy} title="Sin objetivos individuales todavía" description="Creá un objetivo individual con esta métrica para que aparezca acá el ranking." className="border-none py-6" />
      ) : (
        <ul className="flex flex-col divide-y divide-border-default">
          {entries.map((e) => (
            <li key={e.memberId} className={cn("flex items-center gap-3 py-2.5", e.memberId === currentMemberId && "-mx-2 rounded-md bg-accent-50 px-2")}>
              <span className={cn("w-5 shrink-0 text-center font-mono text-sm font-semibold", e.position <= 3 ? MEDAL_COLOR[e.position - 1] : "text-neutral-400")}>#{e.position}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{e.memberName}</span>
              <span className="shrink-0 font-mono text-sm text-foreground">{e.progressPct}%</span>
              {e.changePct !== null && (
                <span className={cn("flex shrink-0 items-center gap-0.5 text-xs", e.changePct >= 0 ? "text-success-strong" : "text-error-strong")}>
                  {e.changePct >= 0 ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
                  {Math.abs(e.changePct)}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
