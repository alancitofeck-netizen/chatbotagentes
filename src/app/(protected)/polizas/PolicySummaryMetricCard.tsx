import type { LucideIcon } from "lucide-react";

/** Tarjeta compacta genérica para valores monetarios de la póliza (Prima,
 * Suma asegurada, Comisión) — mismo lenguaje visual que SimulationMetricCard
 * (Mini Apps), componente propio de Pólizas. El caller decide si el dato
 * existe (`detail.premium !== null`, etc.) antes de renderizar — este
 * componente nunca inventa un valor. */
export function PolicySummaryMetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-2 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
        <Icon className="size-3.5 text-accent-600" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
