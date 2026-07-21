import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  variant?: "accent" | "success" | "warning" | "error";
}

const VARIANT_FILL: Record<NonNullable<ProgressBarProps["variant"]>, string> = {
  accent: "bg-accent-500",
  success: "bg-success-strong",
  warning: "bg-warning-strong",
  error: "bg-error-strong",
};

/** Objetivos section's meta-vs-actual bars (KPIs module) — no existing
 * progress-bar primitive in the project, built to the same token language
 * as the rest of src/components/ui (radius-full track, accent fill). */
export function ProgressBar({ value, className, variant = "accent" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]", VARIANT_FILL[variant])}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
