import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type StatusBadgeVariant = "neutral" | "accent" | "success" | "warning";

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  neutral: "bg-surface-3 text-neutral-600",
  accent: "bg-accent-500/15 text-accent-700",
  success: "bg-success-strong/15 text-success-strong",
  warning: "bg-warning-strong/15 text-warning-strong",
};

/** Badge compacto para las pantallas de "informe" (ver ResponseSummaryScreen)
 * — el `Badge` genérico de @/components/ui/Badge tiene otra escala de
 * tamaño/padding, por eso este vive separado en vez de agregarle variantes a
 * un primitivo compartido por todo el CRM. */
export function StatusBadge({ variant = "neutral", children, className }: { variant?: StatusBadgeVariant; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", VARIANT_CLASSES[variant], className)}>
      {children}
    </span>
  );
}
