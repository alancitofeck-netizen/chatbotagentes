"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  FINANCE_CATEGORIES,
  financeStatus,
  formatMoney,
  methodIcon,
  parseIsoDate,
  statusLabel,
  toBase,
  type FinanceItem,
  type FinanceSettings,
  type FinanceStatus,
} from "@/lib/finance/model";

/** Piezas visuales del módulo Finanzas — mismo lenguaje que el diseño de referencia (tarjeta de
 * resumen en teal, tarjetas chicas, filas con ícono por categoría, montos en mono). */

export const OUT_TEXT = "text-[#c2410c] dark:text-[#f08a4b]";
export const IN_TEXT = "text-success";

const TAG_CLASS: Record<FinanceStatus, string> = {
  late: "bg-error-bg text-error",
  soon: "bg-warning-bg text-warning",
  pend: "bg-warning-bg text-warning",
  done: "bg-success-bg text-success",
};

export function monthLabel(m: Date): string {
  const t = m.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return t[0].toUpperCase() + t.slice(1);
}

export function MonthNav({ month, onShift, className }: { month: Date; onShift: (n: number) => void; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <button type="button" aria-label="Mes anterior" onClick={() => onShift(-1)} className="flex size-9 items-center justify-center rounded-[10px] border border-border-default bg-surface-1 hover:border-accent-500">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <h2 className="min-w-[150px] text-center text-base font-semibold text-foreground">{monthLabel(month)}</h2>
      <button type="button" aria-label="Mes siguiente" onClick={() => onShift(1)} className="flex size-9 items-center justify-center rounded-[10px] border border-border-default bg-surface-1 hover:border-accent-500">
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function PageHead({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-[28px]">{title}</h1>
        <p className="mt-0.5 text-[13px] text-neutral-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function HeroCard({ children }: { children: ReactNode }) {
  return <div className="mb-3.5 rounded-[20px] bg-accent-600 p-5 text-white sm:p-[22px]">{children}</div>;
}

export function MiniCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-sm)]">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={cn("mt-1 font-mono text-[17px] font-semibold", valueClass)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {action}
    </div>
  );
}

export function EmptyRows({ children = "No hay movimientos acá" }: { children?: ReactNode }) {
  return <div className="py-7 text-center text-sm text-neutral-500">{children}</div>;
}

export function FinanceItemRow({ item, today, settings, onOpen, soft }: { item: FinanceItem; today: string; settings: FinanceSettings; onOpen: (item: FinanceItem) => void; soft?: boolean }) {
  const c = FINANCE_CATEGORIES[item.cat];
  const s = financeStatus(item, today);
  const dateLabel = parseIsoDate(item.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const meta =
    item.type === "out"
      ? `${item.method ? `${methodIcon(item.method)} ${item.method}` : "Sin medio"}${item.methodDetail ? ` · ${item.methodDetail}` : ""}`
      : `${item.party || "—"} · ${dateLabel}`;

  return (
    <button
      type="button"
      data-key={item.key}
      onClick={() => onOpen(item)}
      className={cn(
        "mb-2 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:border-accent-500",
        soft ? "border-transparent bg-surface-2 hover:bg-surface-1" : "border-border-default bg-surface-1",
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${c.color}1f` }} aria-hidden="true">
        {c.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-500">
          <span className="truncate">{meta}</span>
          {item.rec && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              · <Repeat className="size-3" aria-hidden="true" />
              {item.rec}
            </span>
          )}
        </div>
      </div>
      <div className="hidden w-[170px] shrink-0 text-xs text-neutral-500 2xl:block">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border-default bg-surface-2 px-2 py-0.5 text-foreground">
          {c.icon} {c.label}
        </span>
        <div className="mt-1 truncate">{item.type === "out" ? item.party : item.method ? `${methodIcon(item.method)} ${item.method}` : ""}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("font-mono text-sm font-semibold", item.type === "in" ? IN_TEXT : OUT_TEXT)}>
          {item.type === "in" ? "+" : "−"}
          {formatMoney(item.amount, item.cur)}
        </div>
        {item.cur !== settings.baseCurrency && <div className="font-mono text-[11px] text-neutral-500">≈ {formatMoney(toBase(item.amount, item.cur, settings), settings.baseCurrency)}</div>}
        <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", TAG_CLASS[s])}>{statusLabel(item, s)}</span>
      </div>
    </button>
  );
}

export function ItemList({ items, ...rest }: { items: FinanceItem[]; today: string; settings: FinanceSettings; onOpen: (item: FinanceItem) => void; soft?: boolean }) {
  if (items.length === 0) return <EmptyRows />;
  return (
    <>
      {items.map((i) => (
        <FinanceItemRow key={i.key} item={i} {...rest} />
      ))}
    </>
  );
}
