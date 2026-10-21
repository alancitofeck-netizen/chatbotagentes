"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, Plus, CalendarDays } from "lucide-react";
import { KpiTile } from "@/components/ui/KpiTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { formatCurrency } from "@/lib/utils/format";
import { toUsd } from "@/lib/finanzas/exchangeRates";
import { getCalendarioTabDataAction, markMovimientoPaidAction, markMovimientoPendingAction } from "@/lib/finanzas/actions";
import { buildRecordatorioMessage } from "@/lib/finanzas/reminders";
import type { CalendarioTabData, FinanzasMovimiento } from "@/lib/finanzas/queries";
import { FINANZAS_CATEGORIES, FINANZAS_BUCKET_LABEL, FINANZAS_BUCKET_VARIANT, deriveFinanzasBucket, type FinanzasTipo } from "@/lib/finanzas/constants";
import { getMonday, addDays } from "@/lib/calendar/week";

const WEEKDAY = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayIso(): string {
  return iso(new Date());
}
function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtOriginal(m: FinanzasMovimiento) {
  return `${Math.round(m.monto).toLocaleString("es-AR")} ${m.moneda}`;
}
function fmtShort(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function FinanzasCalendarioTab({
  refreshKey,
  onNewCobro,
  onNewGasto,
  onEdit,
  onChanged,
}: {
  refreshKey: number;
  onNewCobro: () => void;
  onNewGasto: () => void;
  onEdit: (m: FinanzasMovimiento) => void;
  onChanged: () => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [seg, setSeg] = useState<"" | FinanzasTipo>("");
  const [categoria, setCategoria] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [data, setData] = useState<CalendarioTabData | null>(null);
  const [loading, setLoading] = useState(false);

  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const firstOfMonth = new Date(y, m - 1, 1);
    const start = getMonday(firstOfMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const gridStartIso = iso(grid[0]);
  const gridEndIso = iso(grid[41]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => !cancelled && setLoading(true));
    getCalendarioTabDataAction({ gridStart: gridStartIso, gridEnd: gridEndIso, tipo: seg || undefined, categoria: categoria || undefined, search: search || undefined })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gridStartIso, gridEndIso, seg, categoria, search, refreshKey]);

  const today = todayIso();
  const itemsByDay = useMemo(() => {
    const map = new Map<string, FinanzasMovimiento[]>();
    for (const i of data?.items ?? []) {
      const arr = map.get(i.fechaVencimiento) ?? [];
      arr.push(i);
      map.set(i.fechaVencimiento, arr);
    }
    return map;
  }, [data]);

  const categorias = seg === "in" ? (["poliza", "asesoria", "venta"] as const) : seg === "out" ? (["herramienta", "curso", "gasto"] as const) : null;

  const panelItems = selectedDay ? (itemsByDay.get(selectedDay) ?? []) : (data?.pendientes15 ?? []);
  const panelTitle = selectedDay
    ? new Date(selectedDay).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    : "Próximos 15 días";

  async function handlePagar(m: FinanzasMovimiento) {
    try {
      await markMovimientoPaidAction(m.id);
      toast.success(m.tipo === "in" ? "Marcado como cobrado" : "Marcado como pagado");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }
  async function handleDeshacer(m: FinanzasMovimiento) {
    try {
      await markMovimientoPendingAction(m.id);
      toast.success("Deshecho");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo deshacer.");
    }
  }
  function handleRecordar(m: FinanzasMovimiento) {
    toast.info("Mensaje sugerido", buildRecordatorioMessage(m));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Por cobrar · 15 días" value={formatCurrency(data?.kpis.porCobrar15Usd ?? 0, "USD")} hint={`${data?.kpis.porCobrar15Count ?? 0} movimientos`} />
        <KpiTile label="Por pagar · 15 días" value={formatCurrency(data?.kpis.porPagar15Usd ?? 0, "USD")} hint={`${data?.kpis.porPagar15Count ?? 0} gastos`} />
        <KpiTile
          label="En riesgo (vencidos)"
          value={formatCurrency(data?.kpis.enRiesgoUsd ?? 0, "USD")}
          hint={`${data?.kpis.enRiesgoCount ?? 0} cobros${data && data.kpis.pagosVencidosCount > 0 ? ` · ${data.kpis.pagosVencidosCount} pagos atrasados` : ""}`}
        />
        <KpiTile
          label="Balance del mes"
          value={<span className={(data?.kpis.balanceMesUsd ?? 0) >= 0 ? "text-success-strong" : "text-error-strong"}>{formatCurrency(data?.kpis.balanceMesUsd ?? 0, "USD")}</span>}
          hint={`Cobrado ${formatCurrency(data?.kpis.cobradoMesUsd ?? 0, "USD")} · Pagado ${formatCurrency(data?.kpis.pagadoMesUsd ?? 0, "USD")}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {(["", "in", "out"] as const).map((v) => (
            <button
              key={v || "todo"}
              type="button"
              onClick={() => {
                setSeg(v);
                setCategoria("");
              }}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${seg === v ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
            >
              {v === "" ? "Todo" : v === "in" ? "Por cobrar" : "Por pagar"}
            </button>
          ))}
        </div>
        {categorias && (
          <div className="flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria((cur) => (cur === c ? "" : c))}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium ${categoria === c ? "border-accent-500 bg-accent-100 text-accent-700" : "border-border-default text-neutral-500"}`}
              >
                {FINANZAS_CATEGORIES[c].label}
              </button>
            ))}
          </div>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o nota…"
          aria-label="Buscar movimiento"
          className="min-w-[200px] flex-1 rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <Button size="sm" onClick={onNewCobro}>
          <Plus size={14} aria-hidden="true" /> Nuevo cobro
        </Button>
        <Button size="sm" variant="secondary" onClick={onNewGasto}>
          <Plus size={14} aria-hidden="true" /> Nuevo gasto
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-border-default bg-surface-1">
          <div className="flex items-center justify-between border-b border-border-default px-4 py-2.5">
            <span className="text-[13px] font-medium capitalize text-foreground">{monthLabel(month)}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mes anterior" className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2">
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Mes siguiente" className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2">
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-border-default bg-surface-2 text-center text-[11px] font-semibold text-neutral-500 uppercase">
            {WEEKDAY.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d) => {
              const k = iso(d);
              const inMonth = d.getMonth() === Number(month.split("-")[1]) - 1;
              const evs = itemsByDay.get(k) ?? [];
              const net = evs.filter((e) => e.estado === "pendiente").reduce((s, e) => s + (e.tipo === "in" ? 1 : -1) * toUsd(e.monto, e.moneda), 0);
              const isToday = k === today;
              const isSel = selectedDay === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedDay((cur) => (cur === k ? null : k))}
                  className={`flex min-h-[76px] flex-col gap-0.5 border-r border-b border-border-default p-1.5 text-left last:border-r-0 ${inMonth ? "" : "bg-surface-2/60 text-neutral-400"} ${isSel ? "ring-2 ring-accent-500 ring-inset" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${isToday ? "bg-accent-500 text-white" : ""}`}>{d.getDate()}</span>
                    {net !== 0 && <span className={`text-[10px] font-medium ${net > 0 ? "text-success-strong" : "text-error-strong"}`}>{net > 0 ? "+" : ""}{Math.round(net)}</span>}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {evs.slice(0, 2).map((e) => {
                      const bucket = deriveFinanzasBucket(e.estado, e.fechaVencimiento);
                      const cls = bucket === "vencido" ? "bg-error-bg text-error-strong" : e.tipo === "in" ? "bg-success-bg text-success-strong" : "bg-warning-bg text-warning-strong";
                      return (
                        <span key={e.id} className={`truncate rounded px-1 py-px text-[10px] ${cls} ${e.estado === "pagado" ? "opacity-50 line-through" : ""}`}>
                          {e.descripcion}
                        </span>
                      );
                    })}
                    {evs.length > 2 && <span className="text-[10px] text-neutral-400">+{evs.length - 2} más</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-border-default bg-surface-1 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-foreground">{panelTitle}</h3>
            {selectedDay && (
              <button type="button" onClick={() => setSelectedDay(null)} className="text-[12px] font-medium text-accent-600">
                Ver 15 días
              </button>
            )}
          </div>
          {!selectedDay && <p className="mb-3 text-[12px] text-neutral-500">Incluye vencidos sin resolver.</p>}
          {panelItems.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nada pendiente acá" description="No hay movimientos para mostrar." />
          ) : (
            <div className="flex flex-col divide-y divide-border-default">
              {panelItems.map((i) => {
                const bucket = deriveFinanzasBucket(i.estado, i.fechaVencimiento);
                return (
                  <div key={i.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">{i.descripcion}</p>
                        <p className="text-[11.5px] text-neutral-500">
                          {FINANZAS_CATEGORIES[i.categoria]?.label} · {i.contraparte || "—"} · {fmtShort(i.fechaVencimiento)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[13px] font-medium ${i.tipo === "in" ? "text-success-strong" : "text-error-strong"}`}>
                        {i.tipo === "in" ? "+" : "−"}
                        {fmtOriginal(i)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={FINANZAS_BUCKET_VARIANT[bucket]}>{FINANZAS_BUCKET_LABEL[bucket]}</Badge>
                      <div className="ml-auto flex gap-1.5">
                        {i.estado === "pendiente" ? (
                          <button type="button" onClick={() => handlePagar(i)} className="rounded-md border border-border-default px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-2">
                            {i.tipo === "in" ? "Marcar cobrado" : "Marcar pagado"}
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleDeshacer(i)} className="rounded-md border border-border-default px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-2">
                            Deshacer
                          </button>
                        )}
                        {i.tipo === "in" && i.estado === "pendiente" && (
                          <button type="button" onClick={() => handleRecordar(i)} aria-label="Recordar" className="flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-2">
                            <MessageCircle size={12} aria-hidden="true" /> Recordar
                          </button>
                        )}
                        <button type="button" onClick={() => onEdit(i)} className="rounded-md border border-border-default px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-2">
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {loading && <p className="text-xs text-neutral-400">Actualizando…</p>}
    </div>
  );
}
