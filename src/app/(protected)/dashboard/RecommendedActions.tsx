import Link from "next/link";
import { ClockAlert, ListChecks, MessageSquareWarning, Share2, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { InsightIcon, RecommendedAction } from "@/lib/insights/types";

const ICONS: Record<InsightIcon, LucideIcon> = {
  "message-warning": MessageSquareWarning,
  "clock-alert": ClockAlert,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "list-checks": ListChecks,
  share: Share2,
};

/** A stable checklist shape — an action with count 0 stays in the list
 * (greyed out, "nada pendiente acá") rather than disappearing, so the
 * checklist never jumps around. */
export function RecommendedActions({ actions }: { actions: RecommendedAction[] }) {
  return (
    <Card>
      <CardHeader title="Acciones recomendadas" />
      <ul className="flex flex-col divide-y divide-border-default">
        {actions.map((action) => {
          const Icon = ICONS[action.icon];
          const isDone = action.count === 0;
          return (
            <li key={action.label}>
              <Link
                href={action.href}
                className={`flex items-center gap-3 py-3 ${isDone ? "pointer-events-none opacity-50" : "hover:bg-surface-2"}`}
              >
                <Icon className="size-[18px] shrink-0 text-neutral-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{action.label}</span>
                <Badge variant={isDone ? "neutral" : "accent"}>{isDone ? "Nada pendiente acá" : action.count}</Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
