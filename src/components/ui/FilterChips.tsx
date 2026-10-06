"use client";

import { cn } from "@/lib/utils/cn";

/** Chips de filtro horizontales (scroll contenido en la propia fila). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 shrink-0 rounded-full px-4 text-sm font-medium",
            value === o.value ? "bg-foreground text-surface-1" : "border border-border-default text-neutral-500",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
