import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  /** Ícono principal a la izquierda (ej. formularios "premium" tipo drawers
   * de creación) — opcional, default sin ícono (comportamiento de siempre). */
  icon?: LucideIcon;
  /** "lg" = más alto/redondeado, para superficies destacadas (drawers de
   * creación). Default "md" = clases de siempre, cero cambio visual para
   * los usos existentes — una variante nueva, no un override frágil vía
   * className (este proyecto no usa tailwind-merge, ver Sheet.tsx).
   * Nombrado `uiSize` (no `size`) porque `InputHTMLAttributes` ya define un
   * `size` nativo (numérico, atributo HTML real) — mismo nombre hubiera
   * chocado de tipos. */
  uiSize?: "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, label, error, hint, icon: Icon, uiSize = "md", id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helpId = `${inputId}-help`;
    const isLg = uiSize === "lg";

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          {Icon && (
            <Icon
              className={cn("pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400", isLg ? "size-[18px]" : "size-4")}
              aria-hidden="true"
            />
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            aria-describedby={error || hint ? helpId : undefined}
            className={cn(
              // max-sm: not sm: — this must win ON mobile, not from mobile up,
              // so a caller's own `className` sizing (if any) still wins at sm+.
              "max-sm:min-h-11 w-full border bg-surface-1 text-foreground outline-none",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "placeholder:text-neutral-400",
              "hover:border-border-strong focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isLg ? "h-[50px] rounded-md text-[15px]" : "rounded-sm px-3 py-2 text-sm",
              isLg && (Icon ? "pl-10 pr-3.5" : "px-3.5"),
              error ? "border-error" : "border-border-strong",
              className,
            )}
            {...props}
          />
        </div>
        {(error || hint) && (
          <span
            id={helpId}
            className={cn("text-xs", error ? "text-error-strong" : "text-neutral-500")}
          >
            {error ?? hint}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
