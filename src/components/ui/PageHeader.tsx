import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { BackButton } from "./BackButton";

/** Encabezado de página del prototipo: ícono navy, título en Bricolage y
 * descripción. `actions` queda a la derecha (en mobile baja debajo si no entra).
 *
 * `back` muestra el botón de volver a la izquierda, solo en mobile. `help` (el
 * "¿Qué hago acá?" del módulo) va junto al título en escritorio y debajo de la
 * descripción en mobile, como la referencia. */
export function PageHeader({
  icon: Icon,
  title,
  description,
  titleAdornment,
  help,
  back = false,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Algo chico junto al título. */
  titleAdornment?: ReactNode;
  /** Botón de ayuda del módulo (ModuleHelp). */
  help?: ReactNode;
  back?: boolean;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-w-0 flex-wrap items-center gap-3.5", (back || Boolean(help)) && "max-md:flex-nowrap max-md:items-start max-md:gap-3", className)}>
      {back && <BackButton className="md:hidden" />}
      {Icon && (
        <span className="flex size-[54px] shrink-0 items-center justify-center rounded-lg bg-navy text-white shadow-[var(--elevation-md)]">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-[12rem] flex-1 max-md:min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[28px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground sm:text-[32px]">
            {title}
          </h1>
          {titleAdornment}
          {help && <span className="max-md:hidden">{help}</span>}
        </div>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        {help && <div className="mt-2.5 md:hidden">{help}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
