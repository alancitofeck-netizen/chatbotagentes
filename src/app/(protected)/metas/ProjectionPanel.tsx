"use client";

import { useState } from "react";
import { Sparkles, Loader2, Calendar } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { GoalWithProgress } from "@/lib/goals/actions";
import { generateGoalRecommendationAction } from "@/lib/goals/actions";
import { GOAL_METRIC_META } from "@/lib/goals/constants";
import { paceLabel } from "@/lib/goals/projections";
import { formatCurrency } from "@/lib/utils/format";

const PACE_VARIANT: Record<GoalWithProgress["projection"]["paceStatus"], BadgeVariant> = {
  completed: "success",
  ahead: "success",
  on_track: "info",
  at_risk: "warning",
  behind: "error",
};

function formatMetricValue(value: number, unit: "count" | "currency" | "percent"): string {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percent") return `${Math.round(value)}%`;
  return new Intl.NumberFormat("es").format(Math.round(value));
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

/** "Proyección IA" del spec — la proyección en sí (llegás o no, cuándo) es
 * 100% determinística (goals/projections.ts, ritmo real extrapolado). Lo
 * único que llama a un modelo es la recomendación de texto, bajo demanda
 * por objetivo, nunca automático (tiene costo real de tokens). */
export function ProjectionPanel({ goals }: { goals: GoalWithProgress[] }) {
  const [recommendations, setRecommendations] = useState<Record<string, string>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  function handleGenerate(goalId: string) {
    setGeneratingFor(goalId);
    generateGoalRecommendationAction(goalId)
      .then((result) => {
        if (typeof result !== "string") {
          toast.error(result.error);
          return;
        }
        setRecommendations((prev) => ({ ...prev, [goalId]: result }));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo generar la recomendación."))
      .finally(() => setGeneratingFor(null));
  }

  const active = goals.filter((g) => g.projection.paceStatus !== "completed");
  if (active.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Proyección" />
      <p className="-mt-2 mb-3 text-xs text-neutral-500">
        Calculada con tu ritmo real (avance ÷ días transcurridos) — no es una predicción de IA, es matemática simple. La recomendación de texto sí la escribe un modelo, a pedido.
      </p>
      <ul className="flex flex-col divide-y divide-border-default">
        {active.map((goal) => {
          const meta = GOAL_METRIC_META[goal.metricKey];
          return (
            <li key={goal.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
                  <p className="text-xs text-neutral-500">
                    {formatMetricValue(goal.currentValue, meta.unit)} / {formatMetricValue(goal.targetValue, meta.unit)} · {goal.projection.daysRemaining} días restantes
                  </p>
                </div>
                <Badge variant={PACE_VARIANT[goal.projection.paceStatus]}>{paceLabel(goal.projection.paceStatus)}</Badge>
              </div>

              {goal.projection.estimatedCompletionDate && (
                <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Calendar className="size-3.5" aria-hidden="true" />
                  Al ritmo actual, la alcanzarías el {formatDate(goal.projection.estimatedCompletionDate)}.
                </p>
              )}

              {recommendations[goal.id] ? (
                <p className="rounded-md bg-accent-50 p-2.5 text-xs text-accent-700">{recommendations[goal.id]}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => handleGenerate(goal.id)}
                  disabled={generatingFor === goal.id}
                  className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 disabled:opacity-50"
                >
                  {generatingFor === goal.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
                  Recomendación IA
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
