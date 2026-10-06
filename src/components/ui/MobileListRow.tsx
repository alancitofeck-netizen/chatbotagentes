import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Fila de lista para mobile (mismo lenguaje que el módulo genérico de la
 * maqueta): título, subtítulo opcional y un extremo con estado o fecha. */
export function MobileListRow({
  icon,
  title,
  subtitle,
  end,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  end?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="truncate text-xs text-neutral-500">{subtitle}</div>}
      </div>
      {end && <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-neutral-500">{end}</div>}
    </>
  );
  const base = cn("flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, "active:bg-surface-2")}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
