import { CheckCircle2, ClockAlert, ListChecks, MessageSquareWarning, Share2, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Insight, InsightIcon, InsightPriority } from "@/lib/insights/types";

const ICONS: Record<InsightIcon, LucideIcon> = {
  "message-warning": MessageSquareWarning,
  "clock-alert": ClockAlert,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "list-checks": ListChecks,
  share: Share2,
};

const PRIORITY_STYLES: Record<InsightPriority, { chip: string; icon: string }> = {
  critical: { chip: "bg-error-bg", icon: "text-error-strong" },
  attention: { chip: "bg-warning-bg", icon: "text-warning-strong" },
  positive: { chip: "bg-success-bg", icon: "text-success-strong" },
  info: { chip: "bg-info-bg", icon: "text-info-strong" },
};

export function PriorityInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Sin novedades importantes"
        description="No hay conversaciones sin responder, oportunidades estancadas ni tendencias que revisar."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {insights.map((insight) => {
        const Icon = ICONS[insight.icon];
        const styles = PRIORITY_STYLES[insight.priority];
        return (
          <Card key={insight.id} className="flex flex-col gap-3">
            <span className={`flex size-9 items-center justify-center rounded-full ${styles.chip} ${styles.icon}`}>
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{insight.title}</p>
              <p className="mt-1 text-[13px] text-neutral-500">{insight.explanation}</p>
            </div>
            <LinkButton href={insight.actionHref} variant="secondary" size="sm" className="mt-auto self-start" data-tour="dashboard.insight-link">
              {insight.actionLabel}
            </LinkButton>
          </Card>
        );
      })}
    </div>
  );
}
