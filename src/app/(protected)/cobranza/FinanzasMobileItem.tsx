"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Inbox } from "lucide-react";
import { toUsd } from "@/lib/finanzas/exchangeRates";
import { deriveFinanzasBucket, FINANZAS_BUCKET_VARIANT, type FinanzasCategoria } from "@/lib/finanzas/constants";
import type { FinanzasMovimiento } from "@/lib/finanzas/queries";

export const CATEGORY_ICON: Record<FinanzasCategoria, string> = {
  poliza: "🛡️",
  asesoria: "💬",
  venta: "🛒",
  herramienta: "🧰",
  curso: "🎓",
  gasto: "🧾",
};
export const CATEGORY_COLOR: Record<FinanzasCategoria, string> = {
  poliza: "#1f9d6b",
  asesoria: "#0ea5a5",
  venta: "#3b82f6",
  herramienta: "#c2410c",
  curso: "#a855f7",
  gasto: "#e11d74",
};
export const METHOD_ICON: Record<string, string> = {
  Transferencia: "🏦",
  "Tarjeta de crédito": "💳",
  "Tarjeta de débito": "💳",
  Efectivo: "💵",
  "Mercado Pago": "📱",
  PayPal: "🅿️",
  "Débito automático": "🔁",
  Otro: "•",
};

function bucketLabel(m: FinanzasMovimiento): string {
  const bucket = deriveFinanzasBucket(m.estado, m.fechaVencimiento);
  if (bucket === "pagado") return m.tipo === "in" ? "Cobrado" : "Pagado";
  if (bucket === "vencido") return "Vencido";
  if (bucket === "pronto") return "Pronto";
  return "Pendiente";
}
function fmtOriginal(m: FinanzasMovimiento) {
  return `${Math.round(m.monto).toLocaleString("es-AR")} ${m.moneda}`;
}
function fmtShort(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ItemRow({ item, onClick }: { item: FinanzasMovimiento; onClick: () => void }) {
  const bucket = deriveFinanzasBucket(item.estado, item.fechaVencimiento);
  const meta =
    item.tipo === "out"
      ? `${item.medioPago ? `${METHOD_ICON[item.medioPago] ?? "•"} ${item.medioPago}` : "Sin medio"}${item.detalleMedio ? ` · ${item.detalleMedio}` : ""}`
      : `${item.contraparte || "—"} · ${fmtShort(item.fechaVencimiento)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-border-default bg-surface-1 p-3 text-left shadow-[var(--elevation-xs)]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${CATEGORY_COLOR[item.categoria]}1f` }}>
        {CATEGORY_ICON[item.categoria] ?? "💰"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-foreground">{item.descripcion}</div>
        <div className="truncate text-[12px] text-neutral-500">
          {meta}
          {item.recurrencia !== "ninguna" ? " · ↻" : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-mono text-[14px] font-semibold ${item.tipo === "in" ? "text-success-strong" : "text-error-strong"}`}>
          {item.tipo === "in" ? "+" : "−"}
          {fmtOriginal(item)}
        </div>
        <Badge variant={FINANZAS_BUCKET_VARIANT[bucket]} className="mt-1">
          {bucketLabel(item)}
        </Badge>
      </div>
    </button>
  );
}

export function FlatList({ items, onSelect, emptyMessage = "No hay movimientos acá" }: { items: FinanzasMovimiento[]; onSelect: (m: FinanzasMovimiento) => void; emptyMessage?: string }) {
  if (items.length === 0) return <EmptyState icon={Inbox} title={emptyMessage} />;
  return (
    <div>
      {items.map((i) => (
        <ItemRow key={i.id} item={i} onClick={() => onSelect(i)} />
      ))}
    </div>
  );
}

/** Lista agrupada por día con encabezado ("Hoy" / "lunes 12 oct") entre
 * grupos — solo la pestaña Gastos la usa (mismo criterio que `renderGastos`
 * del prototipo; el resto de las pestañas usan FlatList). */
export function DayGroupedList({ items, onSelect, emptyMessage }: { items: FinanzasMovimiento[]; onSelect: (m: FinanzasMovimiento) => void; emptyMessage: string }) {
  if (items.length === 0) return <EmptyState icon={Inbox} title={emptyMessage} />;
  const today = todayIso();
  let lastDate = "";
  const nodes: ReactNode[] = [];
  for (const i of items) {
    if (i.fechaVencimiento !== lastDate) {
      lastDate = i.fechaVencimiento;
      const label = lastDate === today ? "Hoy" : new Date(lastDate).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" });
      nodes.push(
        <div key={`h-${lastDate}`} className="mt-3.5 mb-1.5 px-0.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase first:mt-0">
          {label}
        </div>,
      );
    }
    nodes.push(<ItemRow key={i.id} item={i} onClick={() => onSelect(i)} />);
  }
  return <div>{nodes}</div>;
}

export function usdValue(m: FinanzasMovimiento): number {
  return toUsd(m.monto, m.moneda);
}
