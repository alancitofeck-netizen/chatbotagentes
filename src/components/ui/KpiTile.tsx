import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Tarjeta de KPI para la grilla de 2 columnas en mobile (igual que el dashboard). */
export function KpiTile({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-sm)]", className)}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 font-display text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}
