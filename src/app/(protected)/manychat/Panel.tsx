import type { ReactNode } from "react";

/** Tarjeta con título que usan el tablero de ManyChat y sus estados de conexión. */
export function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-1 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-neutral-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
