import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        "rounded-sm bg-[linear-gradient(90deg,var(--surface-3)_25%,var(--surface-2)_37%,var(--surface-3)_63%)]",
        "bg-[length:400%_100%] motion-safe:animate-[shimmer_1.4s_ease_infinite]",
        className,
      )}
      {...props}
    />
  );
}
