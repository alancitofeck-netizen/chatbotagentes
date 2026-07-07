import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, label, error, hint, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helpId = `${inputId}-help`;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? helpId : undefined}
          className={cn(
            "rounded-sm border bg-surface-1 px-3 py-2 text-sm text-foreground outline-none",
            "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            "placeholder:text-neutral-400",
            "focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100",
            "disabled:cursor-not-allowed disabled:opacity-40",
            error ? "border-error" : "border-border-strong",
            className,
          )}
          {...props}
        />
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
