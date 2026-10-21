"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Download, MoreHorizontal, Plus, Receipt } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { KpiTile } from "@/components/ui/KpiTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { formatCurrency } from "@/lib/utils/format";
import { toUsd, convertCurrency } from "@/lib/finanzas/exchangeRates";
import { getGastosTabDataAction, deleteMovimientoAction, markMovimientoPaidAction } from "@/lib/finanzas/actions";
import type { GastosTabData, FinanzasMovimiento } from "@/lib/finanzas/queries";
import {
  FINANZAS_CATEGORIES,
  FINANZAS_PAYMENT_METHODS,
  FINANZAS_CURRENCIES,
  FINANZAS_BUCKET_LABEL,
  FINANZAS_BUCKET_VARIANT,
  deriveFinanzasBucket,
  categoriasFor,
} from "@/lib/finanzas/constants";

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

function exportCsv(month: string, items: FinanzasMovimiento[]) {
  const headers = ["Fecha", "Descripción", "Proveedor", "Categoría", "Medio de pago", "Detalle", "Estado", "Monto", "Moneda", "Monto USD"];
  const rows = items.map((i) => [
    i.fechaVencimiento,
    i.descripcion,
    i.contraparte ?? "",
    FINANZAS_CATEGORIES[i.categoria]?.label ?? i.categoria,
    i.medioPago ?? "",
    i.detalleMedio ?? "",
    i.estado === "pagado" ? "Pagado" : "Pendiente",
    String(i.monto),
    i.moneda,
    toUsd(i.monto, i.moneda).toFixed(2),
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gastos-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function BarCard({ title, data, currency }: { title: string; data: { label: string; totalUsd: number }[]; currency: string }) {
  const converted = data.map((d) => ({ ...d, totalUsd: convertCurrency(d.totalUsd, "USD", currency) }));
  return (
    <Card>
      <CardHeader title={title} />
      {converted.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin gastos este mes.</p>
      ) : (
        <div style={{ height: Math.max(120, converted.length * 34) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={converted} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border-default)" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), currency)}
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12, boxShadow: "var(--elevation-md)" }}
              />
              <Bar dataKey="totalUsd" fill="var(--color-out-500, #c2410c)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function FinanzasGastosTab({
  initialMonth,
  initialData,
  refreshKey,
  onNew,
  onEdit,
  onChanged,
}: {
  initialMonth: string;
  initialData: GastosTabData;
  refreshKey: number;
  onNew: () => void;
  onEdit: (m: FinanzasMovimiento) => void;
  onChanged: () => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [search, setSearch] = useState("");
  const [medioPago, setMedioPago] = useState("");
  const [categoria, setCategoria] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<string>("USD");
  const [data, setData] = useState<GastosTabData>(initialData);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanzasMovimiento | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => !cancelled && setLoading(true));
    getGastosTabDataAction({ month, search: search || undefined, medioPago: medioPago || undefined, categoria: categoria || undefined })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, search, medioPago, categoria, refreshKey]);

  async function handlePagar(m: FinanzasMovimiento) {
    try {
      await markMovimientoPaidAction(m.id);
      toast.success("Marcado como pagado");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo marcar el pago.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMovimientoAction(deleteTarget.id);
      toast.success("Gasto borrado");
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el gasto.");
    } finally {
      setDeleting(false);
    }
  }

  const categoriasOut = categoriasFor("out");
  const dc = (usdAmount: number) => convertCurrency(usdAmount, "USD", displayCurrency);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border-default">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mes anterior" className="flex size-9 items-center justify-center text-neutral-500 hover:bg-surface-2">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="min-w-[140px] px-1 text-center text-[13px] font-medium capitalize text-foreground">{monthLabel(month)}</span>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Mes siguiente" className="flex size-9 items-center justify-center text-neutral-500 hover:bg-surface-2">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar gasto, proveedor, tarjeta…"
          aria-label="Buscar gasto"
          className="min-w-[200px] flex-1 rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <select
          aria-label="Filtrar por medio de pago"
          value={medioPago}
          onChange={(e) => setMedioPago(e.target.value)}
          className="rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-[13px] text-foreground"
        >
          <option value="">Todos los medios</option>
          {FINANZAS_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por categoría"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-[13px] text-foreground"
        >
          <option value="">Todas las categorías</option>
          {categoriasOut.map((c) => (
            <option key={c} value={c}>
              {FINANZAS_CATEGORIES[c].label}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => exportCsv(month, data.items)}>
          <Download size={14} aria-hidden="true" /> Exportar CSV
        </Button>
        <div data-tour="finanzas.new-button">
          <Button onClick={onNew}>
            <Plus size={14} aria-hidden="true" /> Nuevo gasto
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span className="text-[12px] text-neutral-500">Mostrar en</span>
        <div className="flex gap-1 rounded-md bg-surface-2 p-0.5">
          {FINANZAS_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDisplayCurrency(c)}
              className={`rounded px-2 py-1 text-[12px] font-medium ${displayCurrency === c ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="finanzas.kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Total del mes" value={formatCurrency(dc(data.kpis.totalMesUsd), displayCurrency)} hint={`${data.kpis.itemsCount} gastos`} />
        <KpiTile label="Ya pagado" value={formatCurrency(dc(data.kpis.yaPagadoUsd), displayCurrency)} />
        <KpiTile label="Pendiente de pago" value={formatCurrency(dc(data.kpis.pendienteUsd), displayCurrency)} hint={`${data.kpis.pendienteVencidosCount} vencidos`} />
        <KpiTile label="Gastos fijos" value={formatCurrency(dc(data.kpis.gastosFijosUsd), displayCurrency)} hint={`${data.kpis.gastosFijosCount} recurrentes`} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <BarCard title="Por categoría" data={data.porCategoria} currency={displayCurrency} />
        <BarCard title="Por medio de pago" data={data.porMedioPago} currency={displayCurrency} />
      </div>

      <Card className="p-0">
        <div className="border-b border-border-default p-4">
          <h3 className="text-[14px] font-medium text-foreground">Gastos del mes</h3>
        </div>
        {data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Receipt} title="No hay gastos este mes" description="Tocá “Nuevo gasto” para cargar el primero." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] text-neutral-500 uppercase">
                <tr className="border-b border-border-default">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Gasto</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Categoría</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Medio de pago</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => {
                  const bucket = deriveFinanzasBucket(i.estado, i.fechaVencimiento);
                  return (
                    <tr key={i.id} className="border-b border-border-default last:border-b-0 hover:bg-surface-2">
                      <td className="px-4 py-2.5 whitespace-nowrap">{new Date(i.fechaVencimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{i.descripcion}</div>
                        <div className="text-[11.5px] text-neutral-500">
                          {i.contraparte ?? ""}
                          {i.recurrencia !== "ninguna" ? ` · ↻ ${i.recurrencia}` : ""}
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">
                        <Badge variant="neutral">{FINANZAS_CATEGORIES[i.categoria]?.label ?? i.categoria}</Badge>
                      </td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">
                        {i.medioPago ?? "—"}
                        {i.detalleMedio && <div className="text-[11.5px] text-neutral-500">{i.detalleMedio}</div>}
                      </td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">
                        <Badge variant={FINANZAS_BUCKET_VARIANT[bucket]}>{FINANZAS_BUCKET_LABEL[bucket]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="font-medium text-error-strong">−{fmtOriginal(i)}</div>
                        {i.moneda !== displayCurrency && (
                          <div className="text-[11.5px] text-neutral-500">≈ {formatCurrency(convertCurrency(i.monto, i.moneda, displayCurrency), displayCurrency)}</div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <DropdownMenu
                          trigger={<MoreHorizontal size={16} aria-hidden="true" />}
                          triggerLabel="Más acciones"
                          items={[
                            ...(i.estado === "pendiente" ? [{ label: "Pagar", onSelect: () => handlePagar(i) }] : []),
                            { label: "Editar", onSelect: () => onEdit(i) },
                            { label: "Borrar", destructive: true, onSelect: () => setDeleteTarget(i) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-right text-[12px] font-semibold text-neutral-500">
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">{formatCurrency(dc(data.kpis.totalMesUsd), displayCurrency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {loading && <p className="text-xs text-neutral-400">Actualizando…</p>}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="¿Borrar este gasto?"
        description={deleteTarget ? `"${deleteTarget.descripcion}" no se puede recuperar.` : undefined}
        confirmLabel="Borrar"
        danger
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
