"use client";

import { useMemo, useState } from "react";
import { BellRing, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  FINANCE_CATEGORIES,
  daysBetween,
  financeStatus,
  formatMoney,
  isoDate,
  methodIcon,
  parseIsoDate,
  sameMonth,
  sumBase,
  toBase,
  type FinanceCategory,
  type FinanceItem,
  type FinanceSettings,
} from "@/lib/finance/model";
import { EmptyRows, FinanceItemRow, HeroCard, IN_TEXT, ItemList, MiniCard, MonthNav, OUT_TEXT, PageHead, SectionTitle } from "./financeUi";

interface ViewProps {
  items: FinanceItem[];
  today: string;
  settings: FinanceSettings;
  onOpen: (item: FinanceItem) => void;
}

const shiftMonth = (m: Date, n: number) => new Date(m.getFullYear(), m.getMonth() + n, 1);
const startOfMonth = (iso: string) => {
  const d = parseIsoDate(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/* ───────────────────────── Gastos ───────────────────────── */

export function GastosView({ items, today, settings, onOpen }: ViewProps) {
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [method, setMethod] = useState("");
  const [query, setQuery] = useState("");
  const fmt = (n: number) => formatMoney(n, settings.baseCurrency);

  const all = useMemo(() => items.filter((i) => i.type === "out" && sameMonth(i.date, month)), [items, month]);
  const paid = all.filter((i) => i.paid);
  const pend = all.filter((i) => !i.paid);
  const total = sumBase(all, settings);
  const pct = total ? (sumBase(paid, settings) / total) * 100 : 0;
  const fixed = all.filter((i) => i.rec);
  const late = pend.filter((i) => financeStatus(i, today) === "late");

  const byMethod = new Map<string, number>();
  for (const i of all) byMethod.set(i.method || "Otro", (byMethod.get(i.method || "Otro") ?? 0) + toBase(i.amount, i.cur, settings));
  const byCat = new Map<FinanceCategory, number>();
  for (const i of all) byCat.set(i.cat, (byCat.get(i.cat) ?? 0) + toBase(i.amount, i.cur, settings));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] ?? 0;

  const q = query.toLowerCase();
  const list = all
    .filter((i) => (!method || (i.method || "Otro") === method) && (!q || `${i.title} ${i.party} ${i.methodDetail}`.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHead eyebrow="Finanzas" title="Gastos" description="Herramientas, cursos y todo lo que pagás, con su medio de pago">
        <MonthNav month={month} onShift={(n) => setMonth((m) => shiftMonth(m, n))} />
      </PageHead>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,380px)_1fr]">
        <div className="min-w-0 xl:sticky xl:top-5">
          <HeroCard>
            <div className="text-xs opacity-85">Total gastado en el mes</div>
            <div className="mb-3 mt-1 font-mono text-[30px] font-bold sm:text-[34px]">{fmt(total)}</div>
            <div className="h-2 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs opacity-95">
              <span>✓ Pagado {fmt(sumBase(paid, settings))}</span>
              <span>⏳ Pendiente {fmt(sumBase(pend, settings))}</span>
            </div>
          </HeroCard>
          <div className="grid grid-cols-2 gap-2.5">
            <MiniCard label="Gastos fijos" value={fmt(sumBase(fixed, settings))} sub={`${fixed.length} suscripciones`} />
            <MiniCard label="Vencidos" value={fmt(sumBase(late, settings))} sub={`${late.length} sin pagar`} valueClass={late.length ? "text-error" : undefined} />
          </div>

          <SectionTitle
            action={
              method ? (
                <button type="button" onClick={() => setMethod("")} className="text-xs font-semibold text-accent-600">
                  Quitar filtro
                </button>
              ) : undefined
            }
          >
            Por medio de pago
          </SectionTitle>
          {byMethod.size === 0 ? (
            <EmptyRows>Sin gastos</EmptyRows>
          ) : (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] xl:mx-0 xl:grid xl:grid-cols-2 xl:overflow-visible xl:px-0">
              {[...byMethod.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([m, v]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => setMethod((cur) => (cur === m ? "" : m))}
                    className={cn(
                      "min-w-[128px] shrink-0 rounded-[14px] border px-3 py-2.5 text-left xl:min-w-0",
                      method === m ? "border-accent-500 bg-accent-50" : "border-border-default bg-surface-1",
                    )}
                  >
                    <div className="text-lg" aria-hidden="true">{methodIcon(m)}</div>
                    <div className="mt-1 text-xs text-neutral-500">{m}</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold">{fmt(v)}</div>
                  </button>
                ))}
            </div>
          )}

          <SectionTitle>Por categoría</SectionTitle>
          <div className="rounded-2xl border border-border-default bg-surface-1 px-3.5 py-3">
            {cats.length === 0 ? (
              <EmptyRows>Sin gastos</EmptyRows>
            ) : (
              cats.map(([k, v]) => (
                <div key={k} className="my-2 grid grid-cols-[110px_1fr_auto] items-center gap-2.5 text-xs">
                  <span>
                    {FINANCE_CATEGORIES[k].icon} {FINANCE_CATEGORIES[k].label}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(v / maxCat) * 100}%`, background: FINANCE_CATEGORIES[k].color }} />
                  </div>
                  <b className="font-mono">{fmt(v)}</b>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-[20px] border border-border-default bg-surface-1 p-3 sm:p-[18px]">
          <div className="mb-1.5 flex items-center gap-2.5">
            <h3 className="hidden flex-1 text-base font-semibold sm:block">Gastos del mes</h3>
            <label className="relative w-full sm:max-w-[300px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar gasto, proveedor o tarjeta…"
                className="w-full rounded-xl border border-border-default bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500"
              />
            </label>
          </div>
          {list.length === 0 ? (
            <EmptyRows>
              No hay gastos cargados.
              <br />
              Tocá “Nuevo gasto” para agregar uno.
            </EmptyRows>
          ) : (
            list.map((i, idx) => (
              <div key={i.key}>
                {(idx === 0 || list[idx - 1].date !== i.date) && (
                  <div className="mx-0.5 mb-1.5 mt-3.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-neutral-500">
                    {i.date === today ? "Hoy" : parseIsoDate(i.date).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })}
                  </div>
                )}
                <FinanceItemRow item={i} today={today} settings={settings} onOpen={onOpen} soft />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Calendario ───────────────────────── */

export function CalendarioView({ items, today, settings, onOpen, selected, onSelect }: ViewProps & { selected: string; onSelect: (iso: string) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(today));
  const fmt = (n: number) => formatMoney(n, settings.baseCurrency);

  const in15 = (i: FinanceItem) => {
    const t = daysBetween(today, i.date);
    return t >= 0 && t <= 15;
  };
  const pend = items.filter((i) => !i.paid);
  const toCollect = pend.filter((i) => i.type === "in" && in15(i));
  const toPay = pend.filter((i) => i.type === "out" && in15(i));

  const byDate = useMemo(() => {
    const map = new Map<string, FinanceItem[]>();
    for (const i of items) map.set(i.date, [...(map.get(i.date) ?? []), i]);
    return map;
  }, [items]);

  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (i >= 35 && d.getMonth() !== month.getMonth()) break;
    cells.push(d);
  }
  const selDate = parseIsoDate(selected);

  return (
    <>
      <PageHead eyebrow="Seguimiento proactivo" title="Calendario" description="Qué cobrás y qué pagás cada día — con 15 días de anticipación" />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <MonthNav month={month} onShift={(n) => setMonth((m) => shiftMonth(m, n))} className="mb-3" />
          <div className="rounded-[18px] border border-border-default bg-surface-1 p-2.5 sm:p-3.5">
            <div className="grid grid-cols-7 text-center">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <div key={i} className="pb-2 pt-1 text-[11px] font-semibold text-neutral-500">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 text-center">
              {cells.map((d) => {
                const k = isoDate(d);
                const ev = byDate.get(k) ?? [];
                const dots = [...new Set(ev.map((e) => (financeStatus(e, today) === "late" ? "var(--color-error)" : e.paid ? "var(--color-neutral-400)" : e.type === "in" ? "var(--color-success)" : "#c2410c")))].slice(0, 3);
                const net = ev.filter((e) => !e.paid).reduce((s, e) => s + (e.type === "in" ? 1 : -1) * toBase(e.amount, e.cur, settings), 0);
                const isSel = selected === k;
                const other = d.getMonth() !== month.getMonth();
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onSelect(k)}
                    aria-pressed={isSel}
                    aria-label={d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                    className={cn(
                      "flex min-h-[46px] flex-col items-center gap-[3px] rounded-xl border border-transparent px-0 pb-1 pt-1.5 sm:min-h-[84px] sm:items-start sm:gap-1.5 sm:p-2 sm:hover:bg-surface-2",
                      isSel && "sm:border-accent-500 sm:bg-accent-50",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-[30px] place-items-center rounded-full text-sm font-semibold sm:size-7 sm:text-[13px]",
                        other && "text-neutral-500 opacity-45",
                        k === today && !isSel && "border-2 border-accent-500 text-accent-600",
                        isSel && "bg-accent-600 text-white",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <span className="flex h-1.5 gap-[3px] sm:h-[7px]">
                      {dots.map((c) => (
                        <i key={c} className="size-1.5 rounded-full sm:size-[7px]" style={{ background: c }} />
                      ))}
                    </span>
                    {net !== 0 && (
                      <span className={cn("hidden font-mono text-[11px] sm:block", net > 0 ? IN_TEXT : OUT_TEXT)}>
                        {net > 0 ? "+" : "−"}
                        {Math.round(Math.abs(net)).toLocaleString("es-MX")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-3.5 grid grid-cols-2 gap-2.5">
            <MiniCard label="↓ Por cobrar · 15 días" value={fmt(sumBase(toCollect, settings))} sub={`${toCollect.length} cobros`} valueClass={IN_TEXT} />
            <MiniCard label="↑ Por pagar · 15 días" value={fmt(sumBase(toPay, settings))} sub={`${toPay.length} gastos`} valueClass={OUT_TEXT} />
          </div>
          <div className="min-w-0 rounded-[20px] border border-border-default bg-surface-1 p-3 sm:p-[18px]">
            <h3 className="mb-1.5 text-base font-semibold first-letter:uppercase">
              {selected === today ? "Hoy" : selDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            <ItemList items={byDate.get(selected) ?? []} today={today} settings={settings} onOpen={onOpen} soft />
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── Cobros ───────────────────────── */

type CobrosSeg = "pend" | "late" | "done";

export function CobrosView({ items, today, settings, onOpen, onOpenAutomations }: ViewProps & { onOpenAutomations: () => void }) {
  const [seg, setSeg] = useState<CobrosSeg>("pend");
  const fmt = (n: number) => formatMoney(n, settings.baseCurrency);
  const ins = items.filter((i) => i.type === "in");
  const late = ins.filter((i) => financeStatus(i, today) === "late");
  const pend = ins.filter((i) => !i.paid && financeStatus(i, today) !== "late");
  const done = ins.filter((i) => i.paid);
  const list = (seg === "pend" ? pend : seg === "late" ? late : done)
    .slice()
    .sort((a, b) => (seg === "done" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));

  const segs: { v: CobrosSeg; label: string; count: number }[] = [
    { v: "pend", label: "Pendientes", count: pend.length },
    { v: "late", label: "Vencidos", count: late.length },
    { v: "done", label: "Cobrados", count: done.length },
  ];

  return (
    <>
      <PageHead eyebrow="Ingresos" title="Cobros" description="Pólizas, asesorías y ventas que te tienen que pagar">
        <button
          type="button"
          onClick={onOpenAutomations}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-border-default bg-surface-1 px-3 py-2 text-sm font-semibold hover:border-accent-500 sm:self-auto"
        >
          <BellRing className="size-4 text-accent-600" aria-hidden="true" />
          Recordatorios automáticos
        </button>
      </PageHead>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:max-w-[620px]">
        <MiniCard label="Pendiente de cobro" value={fmt(sumBase(pend, settings))} sub={`${pend.length} cobros`} valueClass={IN_TEXT} />
        <MiniCard label="⚠ En riesgo" value={fmt(sumBase(late, settings))} sub={`${late.length} vencidos · contactar ya`} valueClass="text-error" />
      </div>
      <div role="tablist" aria-label="Estado de los cobros" className="mb-3 flex rounded-xl border border-border-default bg-surface-1 p-[3px] sm:inline-flex">
        {segs.map((s) => (
          <button
            key={s.v}
            type="button"
            role="tab"
            aria-selected={seg === s.v}
            onClick={() => setSeg(s.v)}
            className={cn("flex-1 whitespace-nowrap rounded-[9px] px-3.5 py-2 text-[13px] font-semibold", seg === s.v ? "bg-accent-50 text-accent-600" : "text-neutral-500")}
          >
            {s.label} <span className="font-mono text-xs opacity-70">{s.count}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyRows />
      ) : (
        <div className="grid gap-x-2.5 lg:grid-cols-2">
          {list.map((i) => (
            <FinanceItemRow key={i.key} item={i} today={today} settings={settings} onOpen={onOpen} />
          ))}
        </div>
      )}
    </>
  );
}

/* ───────────────────────── Resumen ───────────────────────── */

export function ResumenView({ items, today, settings, onOpen }: ViewProps) {
  const [month, setMonth] = useState(() => startOfMonth(today));
  const fmt = (n: number) => formatMoney(n, settings.baseCurrency);
  const paidIn = (i: FinanceItem) => i.paid && i.paidDate !== null && sameMonth(i.paidDate, month);
  const cobrado = sumBase(items.filter((i) => i.type === "in" && paidIn(i)), settings);
  const pagado = sumBase(items.filter((i) => i.type === "out" && paidIn(i)), settings);
  const balance = cobrado - pagado;
  const monthPend = items.filter((i) => sameMonth(i.date, month) && !i.paid);
  const upcoming = items.filter((i) => !i.paid && daysBetween(today, i.date) <= 15).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHead eyebrow="Panorama" title="Resumen" description="Lo que entró, lo que salió y lo que viene">
        <MonthNav month={month} onShift={(n) => setMonth((m) => shiftMonth(m, n))} />
      </PageHead>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,380px)_1fr]">
        <div className="min-w-0 xl:sticky xl:top-5">
          <HeroCard>
            <div className="text-xs opacity-85">Balance del mes (cobrado − pagado)</div>
            <div className="mb-3 mt-1 font-mono text-[30px] font-bold sm:text-[34px]">
              {balance >= 0 ? "+" : "−"}
              {fmt(Math.abs(balance))}
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs opacity-95">
              <span>↓ Cobrado {fmt(cobrado)}</span>
              <span>↑ Pagado {fmt(pagado)}</span>
            </div>
          </HeroCard>
          <div className="grid grid-cols-2 gap-2.5">
            <MiniCard label="Falta cobrar este mes" value={fmt(sumBase(monthPend.filter((i) => i.type === "in"), settings))} valueClass={IN_TEXT} />
            <MiniCard label="Falta pagar este mes" value={fmt(sumBase(monthPend.filter((i) => i.type === "out"), settings))} valueClass={OUT_TEXT} />
          </div>
        </div>
        <div className="min-w-0 rounded-[20px] border border-border-default bg-surface-1 p-3 sm:p-[18px]">
          <h3 className="mb-1.5 text-base font-semibold">Próximos 15 días</h3>
          <ItemList items={upcoming} today={today} settings={settings} onOpen={onOpen} soft />
        </div>
      </div>
    </>
  );
}
