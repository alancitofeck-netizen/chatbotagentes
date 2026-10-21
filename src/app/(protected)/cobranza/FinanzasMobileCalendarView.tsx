"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils/format";
import { deriveFinanzasBucket } from "@/lib/finanzas/constants";
import type { FinanzasMovimiento } from "@/lib/finanzas/queries";
import { getMonday, addDays } from "@/lib/calendar/week";
import { FlatList } from "./FinanzasMobileItem";
import { MonthNav, Mini, sumUsd } from "./FinanzasMobileViews";

const WEEKDAY = ["L", "M", "M", "J", "V", "S", "D"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayIso(): string {
  return iso(new Date());
}

function dotColor(m: FinanzasMovimiento): string {
  const bucket = deriveFinanzasBucket(m.estado, m.fechaVencimiento);
  if (bucket === "vencido") return "bg-error-strong";
  if (m.estado === "pagado") return "bg-neutral-400";
  return m.tipo === "in" ? "bg-success-strong" : "bg-warning-strong";
}

export function CalendarioView({ items, onSelect }: { items: FinanzasMovimiento[]; onSelect: (m: FinanzasMovimiento) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const today = todayIso();

  const pend = useMemo(() => items.filter((i) => i.estado === "pendiente"), [items]);
  const in15 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return iso(d);
  }, []);
  const porCobrar = useMemo(() => pend.filter((i) => i.tipo === "in" && i.fechaVencimiento >= today && i.fechaVencimiento <= in15), [pend, today, in15]);
  const porPagar = useMemo(() => pend.filter((i) => i.tipo === "out" && i.fechaVencimiento >= today && i.fechaVencimiento <= in15), [pend, today, in15]);

  const byDay = useMemo(() => {
    const map = new Map<string, FinanzasMovimiento[]>();
    for (const i of items) {
      const arr = map.get(i.fechaVencimiento) ?? [];
      arr.push(i);
      map.set(i.fechaVencimiento, arr);
    }
    return map;
  }, [items]);

  const grid = useMemo(() => {
    const start = getMonday(new Date(month.getFullYear(), month.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const dayLabel = selectedDay === today ? "Hoy" : new Date(selectedDay).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        <Mini label="↓ Por cobrar · 15 días" value={formatCurrency(sumUsd(porCobrar), "USD")} hint={`${porCobrar.length} cobros`} valueClassName="text-success-strong" />
        <Mini label="↑ Por pagar · 15 días" value={formatCurrency(sumUsd(porPagar), "USD")} hint={`${porPagar.length} gastos`} valueClassName="text-error-strong" />
      </div>

      <MonthNav month={month} onPrev={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} onNext={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} />

      <div className="rounded-[18px] border border-border-default bg-surface-1 p-2.5">
        <div className="grid grid-cols-7 text-center">
          {WEEKDAY.map((w, i) => (
            <div key={i} className="pt-1 pb-2 text-[11px] font-semibold text-neutral-500">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d) => {
            const k = iso(d);
            const other = d.getMonth() !== month.getMonth();
            const isToday = k === today;
            const isSel = k === selectedDay;
            const evs = (byDay.get(k) ?? []).slice(0, 3);
            return (
              <button key={k} type="button" onClick={() => setSelectedDay(k)} className="flex min-h-[46px] flex-col items-center gap-0.5 rounded-xl py-1.5">
                <span
                  className={`grid size-[30px] place-items-center rounded-full text-[14px] font-semibold ${
                    isSel ? "bg-accent-500 text-white" : isToday ? "border-2 border-accent-500 text-accent-600" : other ? "text-neutral-400 opacity-45" : "text-foreground"
                  }`}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {evs.map((e, i) => (
                    <i key={i} className={`size-1.5 rounded-full ${dotColor(e)}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <h3 className="mt-4 mb-1.5 text-[13px] font-semibold text-foreground capitalize">{dayLabel}</h3>
      <FlatList items={byDay.get(selectedDay) ?? []} onSelect={onSelect} emptyMessage="Nada cargado este día" />
    </div>
  );
}
