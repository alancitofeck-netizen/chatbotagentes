import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { DeltaLabel } from "./DeltaLabel";

/** Tile de KPI con ícono + sparkline (bucketByDay real) + delta vs. mes
 * anterior — compartido por Agenda/Operación/KPIs (los 6 tiles de cada
 * pestaña son la misma forma, distinta métrica). */
export function StatTile({
  icon: Icon,
  label,
  value,
  sparklineData,
  deltaPct,
  color = "var(--color-accent-500)",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sparklineData?: number[];
  deltaPct?: number | null;
  color?: string;
}) {
  const hasSparkline = sparklineData && sparklineData.some((v) => v > 0);
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs text-neutral-500">{label}</p>
            <p className="text-lg font-semibold text-foreground">{value}</p>
          </div>
        </div>
        {hasSparkline && <Sparkline data={sparklineData} color={color} />}
      </div>
      {deltaPct !== undefined && <DeltaLabel pct={deltaPct} />}
    </Card>
  );
}
