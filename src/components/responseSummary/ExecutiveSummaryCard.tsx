import { Sparkles, CalendarClock, Users, Star, Hash, Gauge } from "lucide-react";
import type { ExecutiveSummary, ExecutiveSummaryChip } from "./executiveSummary";

const CHIP_ICON: Record<ExecutiveSummaryChip["icon"], typeof CalendarClock> = {
  next_step: CalendarClock,
  referral: Users,
  feedback: Star,
  count: Hash,
  score: Gauge,
};

export function ExecutiveSummaryCard({ summary }: { summary: ExecutiveSummary }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-accent-500/20 bg-accent-500/5 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent-600" aria-hidden="true" />
        <h2 className="text-[15px] font-semibold text-foreground">Resumen ejecutivo</h2>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{summary.sentence}</p>
      {summary.chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.chips.map((chip, i) => {
            const Icon = CHIP_ICON[chip.icon];
            return (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground">
                <Icon className="size-3.5 text-accent-600" aria-hidden="true" />
                {chip.label}: {chip.value}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
