import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, label, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "w-full appearance-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 pr-9 text-sm text-foreground outline-none",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100",
              "disabled:cursor-not-allowed disabled:opacity-40",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
            aria-hidden="true"
          />
        </div>
      </div>
    );
  },
);

Select.displayName = "Select";
