"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { convertCurrency } from "@/lib/finanzas/exchangeRates";
import { FINANZAS_CATEGORIES, FINANZAS_CURRENCIES, type FinanzasCategoria } from "@/lib/finanzas/constants";
import type { FinanzasMovimiento } from "@/lib/finanzas/queries";
import { CATEGORY_COLOR, METHOD_ICON, DayGroupedList, FlatList, usdValue } from "./FinanzasMobileItem";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameMonth(dateIso: string, m: Date): boolean {
  const d = new Date(dateIso);
  return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
}
function monthLabel(m: Date) {
  const label = m.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function shiftMonth(m: Date, n: number): Date {
  return new Date(m.getFullYear(), m.getMonth() + n, 1);
}
function sumUsd(items: FinanzasMovimiento[]): number {
  return items.reduce((s, i) => s + usdValue(i), 0);
}

function MonthNav({ month, onPrev, onNext }: { month: Date; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <button type="button" onClick={onPrev} aria-label="Mes anterior" className="flex size-9 items-center justify-center rounded-lg border border-border-default bg-surface-1">
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <h2 className="text-[16px] font-semibold capitalize text-foreground">{monthLabel(month)}</h2>
      <button type="button" onClick={onNext} aria-label="Mes siguiente" className="flex size-9 items-center justify-center rounded-lg border border-border-default bg-surface-1">
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function CurrencySwitch({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="mb-2 flex items-center justify-end gap-1.5">
      <span className="text-[11px] text-neutral-500">Mostrar en</span>
      <div className="flex gap-1 rounded-md bg-surface-2 p-0.5">
        {FINANZAS_CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`rounded px-2 py-1 text-[12px] font-medium ${value === c ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function Mini({ label, value, hint, valueClassName }: { label: string; value: string; hint?: string; valueClassName?: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-xs)]">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-[17px] font-semibold ${valueClassName ?? "text-foreground"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-neutral-500">{hint}</div>}
    </div>
  );
}

export function GastosView({ items, onSelect }: { items: FinanzasMovimiento[]; onSelect: (m: FinanzasMovimiento) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const [currency, setCurrency] = useState("USD");
  const dc = (usdAmount: number) => convertCurrency(usdAmount, "USD", currency);

  const all = useMemo(() => items.filter((i) => i.tipo === "out" && sameMonth(i.fechaVencimiento, month)), [items, month]);
  const paid = useMemo(() => all.filter((i) => i.estado === "pagado"), [all]);
  const pend = useMemo(() => all.filter((i) => i.estado === "pendiente"), [all]);
  const tot = sumUsd(all);
  const pagadoUsd = sumUsd(paid);
  const pct = tot ? (pagadoUsd / tot) * 100 : 0;
  const rec = useMemo(() => all.filter((i) => i.recurrencia !== "ninguna"), [all]);
  const today = todayIso();
  const late = useMemo(() => pend.filter((i) => i.fechaVencimiento < today), [pend, today]);

  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of all) m.set(i.medioPago || "Otro", (m.get(i.medioPago || "Otro") ?? 0) + usdValue(i));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const byCategoria = useMemo(() => {
    const m = new Map<FinanzasCategoria, number>();
    for (const i of all) m.set(i.categoria, (m.get(i.categoria) ?? 0) + usdValue(i));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const maxCat = byCategoria.length ? byCategoria[0][1] : 0;

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return all
      .filter((i) => (!method || (i.medioPago || "Otro") === method) && (!ql || `${i.descripcion} ${i.contraparte ?? ""} ${i.detalleMedio ?? ""}`.toLowerCase().includes(ql)))
      .sort((a, b) => b.fechaVencimiento.localeCompare(a.fechaVencimiento));
  }, [all, method, q]);

  return (
    <div>
      <MonthNav month={month} onPrev={() => setMonth((m) => shiftMonth(m, -1))} onNext={() => setMonth((m) => shiftMonth(m, 1))} />
      <CurrencySwitch value={currency} onChange={setCurrency} />

      <div className="mb-3.5 rounded-[20px] bg-accent-600 p-[18px] text-[var(--on-accent)]">
        <div className="text-[12px] opacity-85">Total gastado en el mes</div>
        <div className="my-1 font-mono text-[28px] font-semibold">{formatCurrency(dc(tot), currency)}</div>
        <div className="h-2 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[12px] opacity-95">
          <span>✓ Pagado {formatCurrency(dc(pagadoUsd), currency)}</span>
          <span>⏳ Pendiente {formatCurrency(dc(sumUsd(pend)), currency)}</span>
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        <Mini label="Gastos fijos" value={formatCurrency(dc(sumUsd(rec)), currency)} hint={`${rec.length} suscripciones`} />
        <Mini label="Vencidos" value={formatCurrency(dc(sumUsd(late)), currency)} hint={`${late.length} sin pagar`} valueClassName={late.length ? "text-error-strong" : undefined} />
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">Por medio de pago</h3>
        {method && (
          <button type="button" onClick={() => setMethod("")} className="text-[12px] font-semibold text-accent-600">
            Quitar filtro
          </button>
        )}
      </div>
      <div className="-mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-1">
        {byMethod.length === 0 ? (
          <p className="py-2 text-[13px] text-neutral-500">Sin gastos</p>
        ) : (
          byMethod.map(([m, v]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod((cur) => (cur === m ? "" : m))}
              className={`shrink-0 min-w-[128px] rounded-2xl border p-2.5 text-left ${method === m ? "border-accent-500 bg-accent-100" : "border-border-default bg-surface-1"}`}
            >
              <div className="text-[18px]">{METHOD_ICON[m] ?? "•"}</div>
              <div className="mt-1 truncate text-[12px] text-neutral-500">{m}</div>
              <div className="font-mono text-[14px] text-foreground">{formatCurrency(dc(v), currency)}</div>
            </button>
          ))
        )}
      </div>

      <h3 className="mt-4 mb-1.5 text-[13px] font-semibold text-foreground">Por categoría</h3>
      <div className="rounded-2xl border border-border-default bg-surface-1 p-3">
        {byCategoria.length === 0 ? (
          <p className="py-2 text-center text-[13px] text-neutral-500">Sin gastos</p>
        ) : (
          byCategoria.map(([cat, v]) => (
            <div key={cat} className="my-2 grid grid-cols-[96px_1fr_auto] items-center gap-2.5 text-[12px]">
              <span className="truncate text-neutral-600">{FINANZAS_CATEGORIES[cat].label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${maxCat ? (v / maxCat) * 100 : 0}%`, background: CATEGORY_COLOR[cat] }} />
              </div>
              <b className="font-mono text-foreground">{formatCurrency(dc(v), currency)}</b>
            </div>
          ))
        )}
      </div>

      <h3 className="mt-4 mb-1.5 text-[13px] font-semibold text-foreground">Gastos del mes</h3>
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar gasto o proveedor…"
          aria-label="Buscar gasto"
          className="min-h-11 w-full rounded-xl border border-border-strong bg-surface-1 py-2.5 pr-3 pl-9 text-[15px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </label>
      <DayGroupedList items={list} onSelect={onSelect} emptyMessage="No hay gastos cargados este mes." />
    </div>
  );
}

export function CobrosView({ items, onSelect }: { items: FinanzasMovimiento[]; onSelect: (m: FinanzasMovimiento) => void }) {
  const [seg, setSeg] = useState<"pend" | "late" | "done">("pend");
  const today = todayIso();
  const ins = useMemo(() => items.filter((i) => i.tipo === "in"), [items]);
  const pendientes = useMemo(() => ins.filter((i) => i.estado === "pendiente" && i.fechaVencimiento >= today), [ins, today]);
  const vencidos = useMemo(() => ins.filter((i) => i.estado === "pendiente" && i.fechaVencimiento < today), [ins, today]);
  const cobrados = useMemo(() => ins.filter((i) => i.estado === "pagado"), [ins]);

  const list = seg === "pend" ? pendientes : seg === "late" ? vencidos : cobrados;
  const sorted = [...list].sort((a, b) => (seg === "done" ? b.fechaVencimiento.localeCompare(a.fechaVencimiento) : a.fechaVencimiento.localeCompare(b.fechaVencimiento)));

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        <Mini label="Pendiente de cobro" value={formatCurrency(sumUsd(pendientes), "USD")} hint={`${pendientes.length} cobros`} valueClassName="text-success-strong" />
        <Mini label="⚠ En riesgo" value={formatCurrency(sumUsd(vencidos), "USD")} hint={`${vencidos.length} vencidos · contactar ya`} valueClassName="text-error-strong" />
      </div>
      <div className="mb-3 flex gap-1 rounded-xl border border-border-default bg-surface-1 p-1">
        {(
          [
            ["pend", "Pendientes"],
            ["late", "Vencidos"],
            ["done", "Cobrados"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setSeg(v)}
            className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${seg === v ? "bg-accent-100 text-accent-700" : "text-neutral-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <FlatList items={sorted} onSelect={onSelect} emptyMessage="No hay cobros acá" />
    </div>
  );
}

export function ResumenView({ items, onSelect }: { items: FinanzasMovimiento[]; onSelect: (m: FinanzasMovimiento) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const in15 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const pagadosEsteMes = useMemo(() => items.filter((i) => i.estado === "pagado" && i.fechaPago && sameMonth(i.fechaPago, month)), [items, month]);
  const cobrado = sumUsd(pagadosEsteMes.filter((i) => i.tipo === "in"));
  const pagado = sumUsd(pagadosEsteMes.filter((i) => i.tipo === "out"));
  const balance = cobrado - pagado;

  const pendientesDelMes = useMemo(() => items.filter((i) => sameMonth(i.fechaVencimiento, month) && i.estado === "pendiente"), [items, month]);

  const proximos15 = useMemo(
    () =>
      items
        .filter((i) => i.estado === "pendiente" && i.fechaVencimiento <= in15)
        .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)),
    [items, in15],
  );

  return (
    <div>
      <MonthNav month={month} onPrev={() => setMonth((m) => shiftMonth(m, -1))} onNext={() => setMonth((m) => shiftMonth(m, 1))} />

      <div className="mb-3.5 rounded-[20px] bg-accent-600 p-[18px] text-[var(--on-accent)]">
        <div className="text-[12px] opacity-85">Balance del mes (cobrado − pagado)</div>
        <div className="my-1 font-mono text-[28px] font-semibold">
          {balance >= 0 ? "+" : ""}
          {formatCurrency(balance, "USD")}
        </div>
        <div className="flex justify-between text-[12px] opacity-95">
          <span>↓ Cobrado {formatCurrency(cobrado, "USD")}</span>
          <span>↑ Pagado {formatCurrency(pagado, "USD")}</span>
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        <Mini label="Falta cobrar este mes" value={formatCurrency(sumUsd(pendientesDelMes.filter((i) => i.tipo === "in")), "USD")} valueClassName="text-success-strong" />
        <Mini label="Falta pagar este mes" value={formatCurrency(sumUsd(pendientesDelMes.filter((i) => i.tipo === "out")), "USD")} valueClassName="text-error-strong" />
      </div>

      <h3 className="mb-1.5 text-[13px] font-semibold text-foreground">Próximos 15 días</h3>
      <FlatList items={proximos15} onSelect={onSelect} emptyMessage="Nada pendiente en los próximos 15 días" />
    </div>
  );
}

export { todayIso, sameMonth, monthLabel, shiftMonth, sumUsd, MonthNav, Mini };
