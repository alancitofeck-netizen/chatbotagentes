import { Card } from "@/components/ui/Card";
import type { HealthMeta } from "@/lib/insights/types";

/** The Dashboard's insights-first hero card — a small executive report, not
 * a generic greeting. The one "contrast" (dark) card in the view, per the
 * design doc's "at most one per view" rule for that variant. */
export function ExecutiveSummary({
  greetingName,
  bullets,
  health,
}: {
  greetingName: string;
  bullets: string[];
  health: HealthMeta;
}) {
  return (
    <Card variant="contrast" className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-balance">
          {greetingName ? `Buenos días, ${greetingName} 👋` : "Buenos días 👋"}
        </h1>
        <p className="mt-1 text-sm text-white/70">Hoy detectamos lo siguiente:</p>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm text-white/90">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-sm font-medium">
        <span aria-hidden="true">{health.emoji}</span>
        <span>{health.label}</span>
      </div>
    </Card>
  );
}
