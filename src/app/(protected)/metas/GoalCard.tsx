"use client";

import { motion } from "framer-motion";
import { Gift, Target, Users } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { AnimatedCounter } from "./AnimatedCounter";
import type { GoalWithProgress } from "@/lib/goals/actions";
import { GOAL_METRIC_META, type GoalMetricUnit } from "@/lib/goals/constants";
import { paceLabel } from "@/lib/goals/projections";
import { formatCurrency } from "@/lib/utils/format";

const PACE_VARIANT: Record<GoalWithProgress["projection"]["paceStatus"], BadgeVariant> = {
  completed: "success",
  ahead: "success",
  on_track: "info",
  at_risk: "warning",
  behind: "error",
};

function formatMetricValue(value: number, unit: GoalMetricUnit): string {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percent") return `${Math.round(value)}%`;
  return new Intl.NumberFormat("es").format(Math.round(value));
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function GoalCard({ goal, onOpen }: { goal: GoalWithProgress; onOpen: () => void }) {
  const meta = GOAL_METRIC_META[goal.metricKey];
  const pct = Math.min(100, Math.max(0, goal.projection.progressPct));

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-4 rounded-lg bg-surface-1 p-5 text-left shadow-[var(--elevation-sm)] transition-shadow duration-150 hover:shadow-[var(--elevation-md)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {goal.memberId ? <Target className="size-3" aria-hidden="true" /> : <Users className="size-3" aria-hidden="true" />}
            {meta.label}
          </p>
          <p className="truncate text-[15px] font-semibold text-foreground">{goal.name}</p>
        </div>
        {goal.goalKind === "bono" && <Gift className="size-4 shrink-0 text-accent-500" aria-hidden="true" />}
      </div>

      <div className="flex items-end justify-between">
        <span className="font-mono text-[28px] font-semibold leading-none text-foreground">
          <AnimatedCounter value={pct} formatter={(v) => `${Math.round(v)}%`} />
        </span>
        <Badge variant={PACE_VARIANT[goal.projection.paceStatus]}>{paceLabel(goal.projection.paceStatus)}</Badge>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="h-full rounded-full bg-accent-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="font-mono">
          {formatMetricValue(goal.currentValue, meta.unit)} / {formatMetricValue(goal.targetValue, meta.unit)}
        </span>
        <span>{goal.projection.estimatedCompletionDate ? `Est. ${formatDate(goal.projection.estimatedCompletionDate)}` : formatDate(goal.periodEnd)}</span>
      </div>
    </motion.button>
  );
}
