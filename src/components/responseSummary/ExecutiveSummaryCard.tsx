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
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-accent-500/15 via-white/5 to-white/5 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent-300" aria-hidden="true" />
        <h2 className="text-[15px] font-semibold text-white">Resumen ejecutivo</h2>
      </div>
      <p className="text-sm leading-relaxed text-white/85">{summary.sentence}</p>
      {summary.chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.chips.map((chip, i) => {
            const Icon = CHIP_ICON[chip.icon];
            return (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                <Icon className="size-3.5 text-accent-300" aria-hidden="true" />
                {chip.label}: {chip.value}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
