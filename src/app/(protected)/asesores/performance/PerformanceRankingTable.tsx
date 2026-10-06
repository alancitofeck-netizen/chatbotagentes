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
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => {
          const status = STATUS_BADGE[r.status];
          const checked = compareIds.includes(r.setterId);
          return (
            <li
              key={r.setterId}
              onClick={() => onSelect(r.setterId)}
              className="flex items-start gap-3 rounded-2xl border border-border-default bg-surface-1 p-3"
            >
              <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleCompare(r.setterId)}
                  className="size-5 rounded border-border-strong accent-accent-500"
                  aria-label={`Comparar a ${r.setterName}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{r.setterName}</p>
                  <span className="shrink-0 text-sm font-semibold text-foreground">{r.conversionRate}%</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-neutral-500">
                  <span className="truncate">{r.advisorName}</span>
                  <Badge variant={status.variant} dot>
                    {RENDIMIENTO_LABEL[r.status]}
                  </Badge>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                  <dt className="text-neutral-500">Agendas</dt>
                  <dt className="text-neutral-500">Calificadas</dt>
                  <dt className="text-neutral-500">Booking</dt>
                  <dd className="text-foreground">{r.agendas}</dd>
                  <dd className="text-foreground">{r.totals.calificadas}</dd>
                  <dd className="text-foreground">{r.bookingRate}%</dd>
                </dl>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
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
    </>
  );
}
