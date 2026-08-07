import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Target, MessageSquareHeart } from "lucide-react";
import type { GoalProgressSummary } from "@/lib/dashboard/homeQueries";

function goalVariant(pct: number): "success" | "accent" | "warning" {
  if (pct >= 100) return "success";
  if (pct >= 60) return "accent";
  return "warning";
}

export function GoalsProgressPanel({ goals }: { goals: GoalProgressSummary[] }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Avance a tus metas" action={<Link href="/metas" className="text-xs font-medium text-accent-600 hover:underline">Ver todas</Link>} />
      {goals.length === 0 ? (
        <EmptyState icon={Target} title="Sin metas activas" description="Creá un objetivo en Metas y Bonificaciones para verlo acá." />
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((g) => {
            const remaining = Math.max(0, g.targetValue - g.currentValue);
            return (
              <div key={g.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{g.name}</span>
                  <span className="text-sm font-semibold text-foreground">{g.progressPct}%</span>
                </div>
                <ProgressBar value={g.progressPct} variant={goalVariant(g.progressPct)} />
                {remaining > 0 && g.rewardLabel && (
                  <p className="flex items-start gap-1.5 text-xs text-neutral-500">
                    <MessageSquareHeart className="mt-0.5 size-3.5 shrink-0 text-accent-500" aria-hidden="true" />
                    ¡Te falta{remaining === 1 ? "" : "n"} {remaining} para {g.rewardLabel}!
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
