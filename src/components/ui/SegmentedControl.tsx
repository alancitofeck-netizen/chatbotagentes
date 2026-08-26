import { cn } from "@/lib/utils/cn";

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}

/** Reemplazo visual de un <Select> para valores tipo "dial" (pocas opciones
 * fijas en una escala) — mismo contrato de dato controlado, solo cambia el
 * control. Sin primitiva equivalente previa en src/components/ui. */
export function SegmentedControl<T extends string>({ label, value, onChange, options, disabled }: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-sm border border-border-strong bg-surface-1 p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={cn(
                "flex-1 rounded-[calc(var(--radius-sm)-2px)] px-2.5 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                "disabled:cursor-not-allowed disabled:opacity-40",
                active ? "bg-accent-500 text-white" : "text-neutral-600 hover:bg-surface-2",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
