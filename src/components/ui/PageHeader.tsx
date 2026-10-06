import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Encabezado de página del prototipo: ícono navy, título en Bricolage y
 * descripción. `actions` queda a la derecha (en mobile baja debajo si no entra). */
export function PageHeader({
  icon: Icon,
  title,
  description,
  titleAdornment,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Algo chico junto al título (p. ej. el botón de ayuda del módulo). */
  titleAdornment?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-w-0 flex-wrap items-center gap-3.5", className)}>
      {Icon && (
        <span className="flex size-[54px] shrink-0 items-center justify-center rounded-lg bg-navy text-white shadow-[var(--elevation-md)]">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-[12rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[28px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground sm:text-[32px]">
            {title}
          </h1>
          {titleAdornment}
        </div>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
