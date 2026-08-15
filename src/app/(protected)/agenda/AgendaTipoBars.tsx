"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import type { AgendaPerformance } from "@/lib/agenda/queries";

/** "Citas por Tipo" — magnitud (ranking), un solo tono, barras
 * horizontales. Solo cuenta citas con tipo cargado en la hoja — sin tipo
 * queda afuera, nunca agrupado como "otro" inventado. */
export function AgendaTipoBars({ data }: { data: AgendaPerformance | null }) {
  const maxTypeCount = data && data.byType.length > 0 ? Math.max(...data.byType.map((t) => t.count)) : 0;

  return (
    <Card>
      <CardHeader title="Citas por Tipo" />
      {!data || data.byType.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin tipo de cita cargado para este período.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.byType.map((t) => (
            <li key={t.type} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-foreground">{t.type}</span>
                <span className="text-neutral-500">
                  {t.count} ({Math.round((t.count / data.totals.total) * 100)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2">
                <div className="h-2 rounded-full bg-accent-500" style={{ width: `${maxTypeCount > 0 ? (t.count / maxTypeCount) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
