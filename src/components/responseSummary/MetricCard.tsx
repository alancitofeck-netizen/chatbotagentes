import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** `onClick`/`active` opcionales — por defecto (sin onClick) se comporta
 * exactamente igual que siempre (un `div` no interactivo); los callers que
 * lo usan como quick-filter clickeable (ClientesListShell) pasan ambos, el
 * resto de los ~15 usos existentes no se ve afectado. */
export function MetricCard({
  icon: Icon,
  label,
  value,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
        active ? "border-accent-500 bg-accent-500/10" : "border-border-default bg-surface-2 hover:bg-surface-3",
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground">{value}</p>
        <p className="truncate text-xs text-neutral-500">{label}</p>
      </div>
    </Tag>
  );
}
