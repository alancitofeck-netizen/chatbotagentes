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

const RING_CIRCUMFERENCE = 169.6;

const RING_STROKE: Record<GoalWithProgress["projection"]["paceStatus"], string> = {
  completed: "stroke-success-strong",
  ahead: "stroke-success-strong",
  on_track: "stroke-accent-500",
  at_risk: "stroke-warning-strong",
  behind: "stroke-error-strong",
};

/** Tarjeta de objetivo: anillo de avance a la izquierda y el detalle a la derecha (la tarjeta
 * ocupa la mitad de alto que antes en celular). El color del anillo sigue el ritmo del objetivo. */
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
      className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5 rounded-lg bg-surface-1 p-4 text-left shadow-[var(--elevation-sm)] transition-shadow duration-150 hover:shadow-[var(--elevation-md)]"
    >
      <span className="relative size-16">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="27" fill="none" strokeWidth="7" className="stroke-surface-3" />
          <motion.circle
            cx="32"
            cy="32"
            r="27"
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            strokeDasharray={RING_CIRCUMFERENCE}
            initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
            animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - pct / 100) }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
            className={RING_STROKE[goal.projection.paceStatus]}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-[16px] font-extrabold tabular-nums text-foreground">
          <AnimatedCounter value={pct} formatter={(v) => `${Math.round(v)}%`} />
        </span>
      </span>

      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {goal.memberId ? <Target className="size-3 shrink-0" aria-hidden="true" /> : <Users className="size-3 shrink-0" aria-hidden="true" />}
          <span className="truncate">{meta.label}</span>
          {goal.goalKind === "bono" && <Gift className="ml-auto size-4 shrink-0 text-accent-500" aria-hidden="true" />}
        </p>
        <p className="text-[15px] font-semibold leading-snug text-foreground">{goal.name}</p>
        {goal.goalKind === "bono" && goal.rewardLabel && <p className="text-xs font-medium text-accent-700">Premio: {goal.rewardLabel}</p>}
        <p className="mt-0.5 font-mono text-xs text-neutral-500">
          {formatMetricValue(goal.currentValue, meta.unit)} de {formatMetricValue(goal.targetValue, meta.unit)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant={PACE_VARIANT[goal.projection.paceStatus]}>{paceLabel(goal.projection.paceStatus)}</Badge>
          <span className="text-xs text-neutral-500">
            {goal.projection.estimatedCompletionDate ? `Est. ${formatDate(goal.projection.estimatedCompletionDate)}` : `Hasta ${formatDate(goal.periodEnd)}`}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
