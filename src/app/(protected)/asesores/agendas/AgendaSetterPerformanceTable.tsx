import type { AgendaSetterPerformance } from "@/lib/agenda/queries";

/** "Rendimiento de agendas por setter" — específico de QUÉ PASÓ con las
 * citas que generó cada setter (no reemplaza Performance, que analiza sus
 * KPIs de venta completos — ver comentario en AgendasShell). Misma estética
 * de tabla que PerformanceRankingTable.tsx (Asesores → Performance). */
export function AgendaSetterPerformanceTable({ rows }: { rows: AgendaSetterPerformance[] }) {
  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => {
          const asistieron = r.realizadas + r.ventas;
          const showRate = r.citas === 0 ? 0 : Math.round((asistieron / r.citas) * 100);
          return (
            <li key={r.setterId} className="rounded-2xl border border-border-default bg-surface-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{r.setterName}</p>
                <span className="shrink-0 text-sm font-semibold text-foreground">{showRate}% show</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-neutral-500">Citas</dt>
                <dd className="text-right text-foreground">{r.citas}</dd>
                <dt className="text-neutral-500">Confirmadas</dt>
                <dd className="text-right text-foreground">{r.confirmadas}</dd>
                <dt className="text-neutral-500">Asistieron</dt>
                <dd className="text-right text-foreground">{asistieron}</dd>
                <dt className="text-neutral-500">No Show</dt>
                <dd className="text-right text-foreground">{r.noShow}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
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
    </>
  );
}
