"use client";

import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, containerClassName, label, error, hint, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helpId = `${inputId}-help`;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            aria-invalid={Boolean(error)}
            aria-describedby={error || hint ? helpId : undefined}
            className={cn(
              "w-full rounded-sm border bg-surface-1 px-3 py-2 pr-10 text-sm text-foreground outline-none",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "placeholder:text-neutral-400",
              "focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100",
              "disabled:cursor-not-allowed disabled:opacity-40",
              error ? "border-error" : "border-border-strong",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 rounded-sm"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
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

PasswordInput.displayName = "PasswordInput";
