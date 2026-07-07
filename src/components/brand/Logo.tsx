import { cn } from "@/lib/utils/cn";

/**
 * Text wordmark — no Growth Link logo file exists in the repo yet
 * (see docs/blueprint/14-design-system.md). Swap for the real mark once
 * provided; keep the accent-square as the placeholder brand motif.
 */
export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-[6px] text-xs font-semibold",
          inverted ? "bg-white text-primary-950" : "bg-accent-500 text-white",
        )}
        aria-hidden="true"
      >
        G
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold tracking-[-0.02em]",
          inverted ? "text-white" : "text-foreground",
        )}
      >
        Growth Link
      </span>
    </div>
  );
}
