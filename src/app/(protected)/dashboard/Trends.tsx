import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { TrendItem } from "@/lib/insights/types";

/** Always exactly 3 items, never hidden by threshold — this section is
 * descriptive (unlike Priority Insights, which only shows what crosses a
 * threshold). Each includes an interpretive sentence, never a bare %. */
export function Trends({ trends }: { trends: TrendItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {trends.map((trend) => {
        const isPositive = trend.deltaPct !== null && trend.deltaPct >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        return (
          <Card key={trend.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-500">{trend.label}</p>
              {trend.deltaPct !== null && (
                <span className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? "text-success-strong" : "text-error-strong"}`}>
                  <Icon className="size-4" aria-hidden="true" />
                  {isPositive ? "+" : ""}
                  {trend.deltaPct}%
                </span>
              )}
            </div>
            <p className="text-[13px] text-neutral-500">{trend.comment}</p>
          </Card>
        );
      })}
    </div>
  );
}
