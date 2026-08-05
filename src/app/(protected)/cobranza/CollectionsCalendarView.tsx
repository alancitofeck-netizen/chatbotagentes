"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type { CollectionItem } from "@/lib/collections/queries";
import { deriveCollectionBucket, COLLECTION_BUCKET_VARIANT } from "@/lib/collections/constants";
import { getMonday, addDays, parseLocalDate } from "@/lib/calendar/week";

const MAX_VISIBLE_PER_DAY = 3;
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
  const hasOverflow = entries.length > MAX_VISIBLE_PER_DAY;
  const visible = expanded ? entries : entries.slice(0, MAX_VISIBLE_PER_DAY);
  const hiddenCount = entries.length - visible.length;

  return (
    <div className={cn("flex min-h-[124px] flex-col gap-1.5 border-b border-l border-border-default p-2", !inMonth && "bg-surface-2/40")}>
      <span
        className={cn(
          "self-start rounded-full px-2 text-[12px] font-semibold",
          isToday ? "bg-blue-600 text-white" : inMonth ? "text-foreground" : "text-neutral-400",
        )}
      >
        {day.getDate()}
      </span>
      <div className="flex flex-col gap-1">
        {visible.map((item) => (
          <EntryChip key={item.id} item={item} onOpen={onOpen} />
        ))}
        {hasOverflow && hiddenCount > 0 && (
          <button type="button" onClick={onToggleExpand} className="px-1.5 text-left text-[11px] font-medium text-neutral-400 hover:text-accent-700">
            +{hiddenCount} más
          </button>
        )}
        {hasOverflow && hiddenCount === 0 && (
          <button type="button" onClick={onToggleExpand} className="px-1.5 text-left text-[11px] font-medium text-neutral-400 hover:text-accent-700">
            Ver menos
          </button>
        )}
      </div>
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
