import type { AgendaSetterPerformance } from "@/lib/agenda/queries";

/** "Rendimiento de agendas por setter" — específico de QUÉ PASÓ con las
 * citas que generó cada setter (no reemplaza Performance, que analiza sus
 * KPIs de venta completos — ver comentario en AgendasShell). Misma estética
 * de tabla que PerformanceRankingTable.tsx (Asesores → Performance). */
export function AgendaSetterPerformanceTable({ rows }: { rows: AgendaSetterPerformance[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-neutral-500">
            <th className="py-2 pr-3 font-medium">Setter</th>
            <th className="py-2 pr-3 text-right font-medium">Citas</th>
            <th className="py-2 pr-3 text-right font-medium">Confirmadas</th>
            <th className="py-2 pr-3 text-right font-medium">Asistieron</th>
            <th className="py-2 pr-3 text-right font-medium">No Show</th>
            <th className="py-2 pr-2 text-right font-medium">Show Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const asistieron = r.realizadas + r.ventas;
            const showRate = r.citas === 0 ? 0 : Math.round((asistieron / r.citas) * 100);
            return (
              <tr key={r.setterId} className="border-b border-border-default/60 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-foreground">{r.setterName}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.citas}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.confirmadas}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{asistieron}</td>
                <td className="py-2.5 pr-3 text-right text-foreground">{r.noShow}</td>
                <td className="py-2.5 pr-2 text-right font-medium text-foreground">{showRate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
