import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardVariant = "default" | "contrast";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default: "rounded-lg bg-surface-1 shadow-[var(--elevation-sm)]",
  contrast: "rounded-xl bg-primary-950 text-white shadow-[var(--elevation-lg)]",
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return <div className={cn("p-5", variantClasses[variant], className)} {...props} />;
}

export function CardHeader({
  className,
  title,
  action,
  ...props
}: HTMLAttributes<HTMLDivElement> & { title?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)} {...props}>
      {title && <h3 className="text-[15px] font-medium text-inherit">{title}</h3>}
      {action}
    </div>
  );
}
