"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type { CollectionItem } from "@/lib/collections/queries";
import { deriveCollectionBucket, COLLECTION_BUCKET_VARIANT } from "@/lib/collections/constants";
import { formatCurrency } from "@/lib/utils/format";
import { getMonday, addDays, parseLocalDate } from "@/lib/calendar/week";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const CHIP_CLASSES: Record<string, { border: string; bg: string; text: string }> = {
  neutral: { border: "border-l-neutral-300", bg: "bg-surface-3", text: "text-foreground" },
  success: { border: "border-l-success-strong", bg: "bg-success-bg", text: "text-success-strong" },
  warning: { border: "border-l-warning-strong", bg: "bg-warning-bg", text: "text-warning-strong" },
  error: { border: "border-l-error-strong", bg: "bg-error-bg", text: "text-error-strong" },
  info: { border: "border-l-info-strong", bg: "bg-info-bg", text: "text-info-strong" },
  accent: { border: "border-l-accent-500", bg: "bg-accent-100", text: "text-accent-700" },
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function EntryChip({ item, onOpen }: { item: CollectionItem; onOpen: (item: CollectionItem) => void }) {
  const bucket = deriveCollectionBucket(item.status, item.dueDate);
  const variant = COLLECTION_BUCKET_VARIANT[bucket];
  const classes = CHIP_CLASSES[variant] ?? CHIP_CLASSES.neutral;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full flex-col gap-0 truncate rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-[var(--elevation-xs)] transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-[var(--elevation-sm)]",
        classes.border,
        classes.bg,
        classes.text,
      )}
    >
      <span className="truncate text-[10.5px] font-semibold leading-tight">{item.contactName}</span>
      <span className="truncate text-[10px] leading-tight opacity-80">{item.company}</span>
    </button>
  );
}

/** Celda de día — muestra un resumen agregado (ícono + cantidad + monto),
 * no una lista de cobros: el objetivo de esta vista es "a quién le toca
 * pagar cada día" de un vistazo, no reemplazar la Tabla. Un día con algún
 * cobro vencido se pinta entero en rojo con "Vencido $X" — la señal de
 * "contactar ya" tiene que verse sin tener que abrir nada. Clic en el
 * resumen expande la lista real de cobros de ese día (reutiliza EntryChip)
 * para llegar al detalle de uno puntual. */
function DayCell({
  day,
  inMonth,
  entries,
  expanded,
  onToggleExpand,
  onOpen,
}: {
  day: Date;
  inMonth: boolean;
  entries: CollectionItem[];
  expanded: boolean;
  onToggleExpand: () => void;
  onOpen: (item: CollectionItem) => void;
}) {
  const isToday = isSameDay(day, new Date());
  const hasEntries = entries.length > 0;
  const overdueEntries = entries.filter((e) => deriveCollectionBucket(e.status, e.dueDate) === "vencido");
  const hasOverdue = overdueEntries.length > 0;
  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
  const overdueAmount = overdueEntries.reduce((s, e) => s + e.amount, 0);
  const currency = entries[0]?.currency ?? "USD";

  return (
    <div
      className={cn(
        "flex min-h-[124px] flex-col gap-1.5 border-b border-l border-border-default p-2",
        !inMonth && "bg-surface-2/40",
        hasOverdue && "bg-error-bg",
        isToday && "ring-2 ring-inset ring-accent-500",
      )}
    >
      <span
        className={cn(
          "self-start rounded-full px-2 text-[12px] font-semibold",
          isToday ? "bg-accent-500 text-white" : inMonth ? "text-foreground" : "text-neutral-400",
        )}
      >
        {day.getDate()}
      </span>

      {hasOverdue && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-semibold text-error-strong"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          Vencido {formatCurrency(overdueAmount, currency)}
        </button>
      )}
      {!hasOverdue && hasEntries && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-1 truncate rounded-md bg-success-bg px-1.5 py-1 text-left text-[11px] font-semibold text-success-strong"
        >
          <Wallet className="size-3.5 shrink-0" aria-hidden="true" />
          {entries.length} · {formatCurrency(totalAmount, currency)}
        </button>
      )}

      {expanded && hasEntries && (
        <div className="flex flex-col gap-1">
          {entries.map((item) => (
            <EntryChip key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Vista Calendario de Cobranza — mismos helpers/estructura que
 * PolicyCalendarView (Pólizas), un marcador por cobro en su fecha de
 * vencimiento. De solo lectura, sin drag-and-drop. */
export function CollectionsCalendarView({ items, onOpen }: { items: CollectionItem[]; onOpen: (item: CollectionItem) => void }) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CollectionItem[]>();
    for (const item of items) {
      const key = dayKey(parseLocalDate(item.dueDate));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const hasAnyEntries = entriesByDay.size > 0;

  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = getMonday(firstOfMonth);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  function toggleExpand(key: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!hasAnyEntries) {
    return <EmptyState icon={CalendarDays} title="Sin fechas para mostrar" description="Ninguno de los cobros visibles tiene vencimiento cargado." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-foreground">{monthDate.toLocaleDateString("es", { month: "long", year: "numeric" })}</h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => setMonthDate(new Date())}>
            Hoy
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border-t border-r border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-l border-border-default bg-surface-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = dayKey(day);
          return (
            <DayCell
              key={key}
              day={day}
              inMonth={day.getMonth() === monthDate.getMonth()}
              entries={entriesByDay.get(key) ?? []}
              expanded={expandedDays.has(key)}
              onToggleExpand={() => toggleExpand(key)}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}
