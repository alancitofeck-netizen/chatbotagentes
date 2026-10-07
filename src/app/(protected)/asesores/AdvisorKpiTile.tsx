import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Indicador del Resumen de Asesores: ícono y etiqueta (que puede ocupar 2 líneas) arriba y el
 * número grande abajo. Reemplaza al MetricCard compartido solo en esta pantalla, porque ahí la
 * etiqueta se cortaba en celular ("Asesores activ…"). `onClick` lo vuelve un filtro rápido. */
export function AdvisorKpiTile({
  icon: Icon,
  label,
  value,
  onClick,
  active,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onClick?: () => void;
  active?: boolean;
  /** Texto chico bajo el número (p. ej. "Tocá para ver" en los que filtran). */
  hint?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl border p-3 text-left transition-colors sm:p-4",
        active ? "border-accent-500 bg-accent-500/10" : "border-border-default bg-surface-1 shadow-[var(--elevation-xs)]",
        onClick && !active && "hover:border-border-strong",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 text-[12.5px] leading-tight text-neutral-500">{label}</p>
      </div>
      <div>
        <p className="truncate font-mono text-xl font-semibold leading-none text-foreground sm:text-2xl">{value}</p>
        {hint && <p className="mt-1 text-xs font-medium text-accent-700">{hint}</p>}
      </div>
    </Tag>
  );
}
