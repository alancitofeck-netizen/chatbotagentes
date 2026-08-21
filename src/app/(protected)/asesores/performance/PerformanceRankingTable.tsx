import { Scale } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { KpiTotals } from "@/lib/kpis/formulas";
import type { RendimientoStatus } from "@/lib/kpis/aiManager/analysis";
import { RENDIMIENTO_LABEL } from "@/lib/kpis/aiManager/analysis";

export interface RankingRow {
  setterId: string;
  setterName: string;
  advisorName: string;
  totals: KpiTotals;
  acceptanceRate: number;
  responseRate: number;
  conversationRate: number;
  bookingRate: number;
  conversionRate: number;
  agendas: number;
  status: RendimientoStatus;
}

const STATUS_BADGE: Record<RendimientoStatus, { variant: BadgeVariant }> = {
  bueno: { variant: "success" },
  atencion: { variant: "warning" },
  bajo: { variant: "error" },
};

/** Tabla de ranking de "Asesores → Performance" — un setter = una fila,
 * ordenada por Calif. Rate (misma métrica que ya usa conversionRate en el
 * resto de la app). Click en la fila abre el detalle; el checkbox de la
 * primera columna (con stopPropagation) suma/saca del comparador
 * multi-agente sin disparar el detalle. */
export function PerformanceRankingTable({ rows, compareIds, onToggleCompare, onSelect }: { rows: RankingRow[]; compareIds: string[]; onToggleCompare: (setterId: string) => void; onSelect: (setterId: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-neutral-500">
            <th className="w-8 py-2 pr-2">
              <Scale className="size-3.5" aria-hidden="true" />
            </th>
            <th className="py-2 pr-3 font-medium">Agente</th>
            <th className="py-2 pr-3 font-medium">Asesor</th>
            <th className="py-2 pr-3 text-right font-medium">Conexión</th>
            <th className="py-2 pr-3 text-right font-medium">Aceptadas</th>
            <th className="py-2 pr-3 text-right font-medium">Respuestas</th>
            <th className="py-2 pr-3 text-right font-medium">Agendas</th>
            <th className="py-2 pr-3 text-right font-medium">Calificadas</th>
            <th className="py-2 pr-3 text-right font-medium">Accept.</th>
            <th className="py-2 pr-3 text-right font-medium">Resp.</th>
            <th className="py-2 pr-3 text-right font-medium">Conv.</th>
            <th className="py-2 pr-3 text-right font-medium">Booking</th>
            <th className="py-2 pr-3 text-right font-medium">Calif.</th>
            <th className="py-2 pr-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = STATUS_BADGE[r.status];
            const checked = compareIds.includes(r.setterId);
            return (
              <tr
                key={r.setterId}
                onClick={() => onSelect(r.setterId)}
                className="cursor-pointer border-b border-border-default/60 last:border-0 hover:bg-surface-2"
              >
                <td className="py-2.5 pr-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCompare(r.setterId)}
                    className="size-4 rounded border-border-strong accent-accent-500"
                    aria-label={`Comparar a ${r.setterName}`}
                  />
                </td>
                <td className="py-2.5 pr-3 font-medium text-foreground">{r.setterName}</td>
                <td className="py-2.5 pr-3 text-neutral-500">{r.advisorName}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.totals.conexion}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.totals.conexionesAceptadas}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.totals.respuestasPrimerMensaje}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.agendas}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.totals.calificadas}</td>
                <td className="py-2.5 pr-3 text-right text-neutral-500">{r.acceptanceRate}%</td>
                <td className="py-2.5 pr-3 text-right text-neutral-500">{r.responseRate}%</td>
                <td className="py-2.5 pr-3 text-right text-neutral-500">{r.conversationRate}%</td>
                <td className="py-2.5 pr-3 text-right text-neutral-500">{r.bookingRate}%</td>
                <td className="py-2.5 pr-3 text-right font-medium text-foreground">{r.conversionRate}%</td>
                <td className="py-2.5 pr-2">
                  <Badge variant={status.variant} dot>
                    {RENDIMIENTO_LABEL[r.status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
