import type { LucideIcon } from "lucide-react";

export function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-2 p-4 transition-colors hover:bg-surface-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground">{value}</p>
        <p className="truncate text-xs text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
