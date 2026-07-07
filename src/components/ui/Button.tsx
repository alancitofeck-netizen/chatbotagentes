import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent-500 text-white hover:bg-accent-600 disabled:hover:bg-accent-500",
  secondary: "bg-transparent text-foreground border border-border-strong hover:bg-surface-2",
  ghost: "bg-transparent text-foreground hover:bg-surface-2",
  destructive: "bg-transparent text-error-strong hover:bg-error-bg",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-[13px] leading-[18px] px-3 py-1.5 rounded-sm gap-1.5",
  md: "text-sm leading-5 px-4 py-2 rounded-md gap-2",
  lg: "text-[15px] leading-6 px-5 py-2.5 rounded-md gap-2",
};

/** Shared with LinkButton so a nav link can look exactly like a <button>. */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
    "focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2",
    disabled && "opacity-40 cursor-not-allowed pointer-events-none",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClassName({ variant, size, fullWidth, disabled: disabled || loading, className })}
        {...props}
      >
        {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
