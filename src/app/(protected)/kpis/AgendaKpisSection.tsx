"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarCheck2, CheckCircle2, XCircle, Ban, TrendingUp, Loader2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAgendaPerformanceAction } from "@/lib/agenda/actions";
import type { AgendaSetterPerformance, AgendaAdvisorPerformance } from "@/lib/agenda/queries";
import { getMonday } from "@/lib/calendar/week";

type Preset = "week" | "month" | "year";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "year", label: "Este año" },
];

/** Mismo resultado que resolveDateRange (src/lib/crm/analyticsRange.ts,
 * "server-only") para los 3 presets que ofrece esta pantalla — reimplementado
 * localmente porque ese archivo no puede importarse desde un Client
 * Component. El rango cubre el período COMPLETO (hasta el final de la
 * semana/mes/año), no solo "hasta hoy" — mismo fix y misma razón que
 * useAgendaPerformance.ts (Agenda mira hacia adelante). */
function rangeForPreset(preset: Preset): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (preset === "week") {
    start = getMonday(now);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  } else if (preset === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function Tile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
        <Icon className="size-4.5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </Card>
  );
}

function PerformanceTable<T extends { citas: number; realizadas: number; noShow: number; canceladas: number; ventas: number }>({
  title,
  rows,
  nameKey,
  nameLabel,
}: {
  title: string;
  rows: T[];
  nameKey: keyof T;
  nameLabel: string;
}) {
  return (
    <Card>
      <p className="mb-3 text-[15px] font-medium text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin datos en este período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="pb-2 font-medium">{nameLabel}</th>
                <th className="pb-2 font-medium">Citas</th>
                <th className="pb-2 font-medium">Realizadas</th>
                <th className="pb-2 font-medium">No Show</th>
                <th className="pb-2 font-medium">Canceladas</th>
                <th className="pb-2 font-medium">Ventas</th>
                <th className="pb-2 font-medium">Conversión</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border-default">
                  <td className="py-2 font-medium text-foreground">{String(r[nameKey])}</td>
                  <td className="py-2">{r.citas}</td>
                  <td className="py-2">{r.realizadas}</td>
                  <td className="py-2">{r.noShow}</td>
                  <td className="py-2">{r.canceladas}</td>
                  <td className="py-2">{r.ventas}</td>
                  <td className="py-2">{r.citas > 0 ? Math.round((r.ventas / r.citas) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** KPIs → Agendas: analítico, agregado en vivo sobre agenda_appointments
 * (mismo criterio "sin rollups" que getClientSetterPerformance) — separado
 * de /agenda (operativo), pedido explícito del usuario de no mezclar ambas
 * funciones. Gateado a owner/admin: getAgendaPerformanceAction (agenda/actions.ts)
 * tira una excepción para cualquier otro rol (requireManagerRole), así que
 * `isManager` evita siquiera intentar el fetch para un agente — antes eso
 * rompía la carga entera de la pestaña. */
export function AgendaKpisSection({ isManager }: { isManager: boolean }) {
  const [preset, setPreset] = useState<Preset>("month");
  const [data, setData] = useState<{ scope: "agency" | "advisor"; bySetter: AgendaSetterPerformance[]; byAdvisor: AgendaAdvisorPerformance[]; totals: Record<string, number> } | null>(null);
  const [loading, startTransition] = useTransition();

  const range = useMemo(() => rangeForPreset(preset), [preset]);

  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    startTransition(async () => {
      const result = await getAgendaPerformanceAction(range);
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [isManager, range]);

  if (!isManager) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState icon={ShieldAlert} title="Acceso restringido" description="Este análisis es solo para owner/admin del workspace." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <Select label="" containerClassName="w-auto" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </Select>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Cargando…
        </div>
      ) : !data || data.totals.total === 0 ? (
        <EmptyState icon={CalendarCheck2} title="Sin citas en este período" description="Todavía no hay citas sincronizadas para el rango elegido." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile icon={CalendarCheck2} label="Total citas" value={data.totals.total} />
            <Tile icon={CheckCircle2} label="Realizadas" value={data.totals.realizada} />
            <Tile icon={XCircle} label="No Show" value={data.totals.no_show} />
            <Tile icon={Ban} label="Canceladas" value={data.totals.cancelada} />
            <Tile icon={TrendingUp} label="Ventas" value={data.totals.venta} />
          </div>

          <PerformanceTable title="Rendimiento por Setter" rows={data.bySetter} nameKey="setterName" nameLabel="Setter" />
          {data.scope === "agency" && <PerformanceTable title="Rendimiento por Asesor" rows={data.byAdvisor} nameKey="advisorName" nameLabel="Asesor" />}
        </>
      )}
    </div>
  );
}
