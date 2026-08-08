import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "confirmed";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-accent-500 to-primary-600 text-white hover:brightness-110",
  secondary: "border border-border-default bg-surface-2 text-foreground hover:bg-surface-3",
  confirmed: "border border-success-strong/30 bg-success-strong/10 text-success-strong cursor-default",
};

interface LeadActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: React.ReactNode;
}

/** Mismas 3 apariencias que antes vivían como <Button variant="secondary">
 * sueltos — misma acción/lógica del caller, solo el estilo cambia (ver
 * LeadDetailDrawer.tsx). `variant="confirmed"` es un estado, no un botón
 * clickeable (mismo `disabled` que ya usaba el drawer para "Ya es
 * Contacto"/"Ya está en el Pipeline"). */
export const LeadActionButton = forwardRef<HTMLButtonElement, LeadActionButtonProps>(
  ({ variant = "secondary", loading = false, icon, disabled, className, children, ...props }, ref) => {
    const isConfirmed = variant === "confirmed";
    return (
      <button
        ref={ref}
        disabled={disabled || loading || isConfirmed}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-[120ms]",
          VARIANT_CLASSES[variant],
          (disabled || loading) && !isConfirmed && "cursor-not-allowed opacity-40",
          className,
        )}
        {...props}
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : isConfirmed ? <CheckCircle2 className="size-4" aria-hidden="true" /> : icon}
        {children}
      </button>
    );
  },
);
LeadActionButton.displayName = "LeadActionButton";
