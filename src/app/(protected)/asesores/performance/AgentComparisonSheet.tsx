"use client";

import { X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { RENDIMIENTO_LABEL } from "@/lib/kpis/aiManager/analysis";
import type { RankingRow } from "./PerformanceRankingTable";

const METRIC_ROWS: { label: string; pick: (r: RankingRow) => number; suffix?: string }[] = [
  { label: "Conexión", pick: (r) => r.totals.conexion },
  { label: "Aceptadas", pick: (r) => r.totals.conexionesAceptadas },
  { label: "Respuestas", pick: (r) => r.totals.respuestasPrimerMensaje },
  { label: "Agendas", pick: (r) => r.agendas },
  { label: "Calificadas", pick: (r) => r.totals.calificadas },
  { label: "Acceptance Rate", pick: (r) => r.acceptanceRate, suffix: "%" },
  { label: "Response Rate", pick: (r) => r.responseRate, suffix: "%" },
  { label: "Conversation Rate", pick: (r) => r.conversationRate, suffix: "%" },
  { label: "Booking Rate", pick: (r) => r.bookingRate, suffix: "%" },
  { label: "Calif. Rate", pick: (r) => r.conversionRate, suffix: "%" },
];

/** Comparación multi-agente lado a lado — resalta el mejor (verde) y el peor
 * (rojo) de CADA fila/métrica entre los agentes seleccionados (no un
 * ranking global, solo dentro del grupo comparado). */
export function AgentComparisonSheet({ rows, onClose, onRemove }: { rows: RankingRow[]; onClose: () => void; onRemove: (setterId: string) => void }) {
  return (
    <Sheet open onClose={onClose} title={`Comparar agentes (${rows.length})`} className="max-w-3xl">
      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">Métrica</th>
              {rows.map((r) => (
                <th key={r.setterId} className="py-2 pr-3 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground">{r.setterName}</span>
                    <button type="button" onClick={() => onRemove(r.setterId)} aria-label={`Quitar a ${r.setterName}`} className="text-neutral-400 hover:text-foreground">
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((metric) => {
              const values = rows.map((r) => metric.pick(r));
              const max = Math.max(...values);
              const min = Math.min(...values);
              return (
                <tr key={metric.label} className="border-b border-border-default/60 last:border-0">
                  <td className="py-1.5 pr-3 text-neutral-500">{metric.label}</td>
                  {rows.map((r, i) => {
                    const value = values[i];
                    const isBest = value === max && max !== min;
                    const isWorst = value === min && max !== min;
                    return (
                      <td key={r.setterId} className={`py-1.5 pr-3 font-medium ${isBest ? "text-success-strong" : isWorst ? "text-error-strong" : "text-foreground"}`}>
                        {value}
                        {metric.suffix ?? ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <td className="py-1.5 pr-3 text-neutral-500">Estado</td>
              {rows.map((r) => (
                <td key={r.setterId} className="py-1.5 pr-3">
                  <Badge variant={r.status === "bueno" ? "success" : r.status === "atencion" ? "warning" : "error"} dot>
                    {RENDIMIENTO_LABEL[r.status]}
                  </Badge>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}
