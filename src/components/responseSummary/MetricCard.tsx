import type { LucideIcon } from "lucide-react";

export function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/[0.07]">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-200">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-white">{value}</p>
        <p className="truncate text-xs text-white/60">{label}</p>
      </div>
    </div>
  );
}
