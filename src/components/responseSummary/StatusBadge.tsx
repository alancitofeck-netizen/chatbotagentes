import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type StatusBadgeVariant = "neutral" | "accent" | "success" | "warning";

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  neutral: "bg-white/10 text-white/80",
  accent: "bg-accent-500/20 text-accent-200",
  success: "bg-success-strong/20 text-[#7CE7B0]",
  warning: "bg-warning-strong/20 text-[#F5C77E]",
};

/** Badge para superficies oscuras (ver ResponseSummaryScreen) — el `Badge`
 * genérico de @/components/ui/Badge asume fondo claro, por eso este es
 * chico y separado en vez de agregarle variantes dark a un primitivo
 * compartido por todo el CRM. */
export function StatusBadge({ variant = "neutral", children, className }: { variant?: StatusBadgeVariant; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", VARIANT_CLASSES[variant], className)}>
      {children}
    </span>
  );
}
