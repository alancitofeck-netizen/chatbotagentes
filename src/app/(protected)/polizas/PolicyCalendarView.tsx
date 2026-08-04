"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import type { PolicyListItem } from "@/lib/policies/queries";
import { POLICY_STATUS_BADGE_VARIANT } from "@/lib/policies/constants";
import { buildPolicyCalendarEntries, type PolicyCalendarEntry } from "@/lib/policies/calendarEntries";
import { getMonday, addDays, parseLocalDate } from "@/lib/calendar/week";

const MAX_VISIBLE_PER_DAY = 3;
const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Mismos 5 colores que Badge.tsx, pero con un borde izquierdo para el chip
 * — mapea la variante ya compartida con Tabla/Kanban (POLICY_STATUS_BADGE_VARIANT)
 * a las mismas clases, para que "Vencida" se vea roja acá igual que en todos
 * lados. "Cobro" usa "accent" (mismo tono que el badge de Ramo en la Tabla),
 * deliberadamente distinto de los 5 colores de estado para no confundirse
 * con un marcador de renovación. */
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

function EntryChip({ entry, onOpen }: { entry: PolicyCalendarEntry; onOpen: (policy: PolicyListItem) => void }) {
  const variant = entry.kind === "payment" ? "accent" : POLICY_STATUS_BADGE_VARIANT[entry.policy.status as keyof typeof POLICY_STATUS_BADGE_VARIANT];
  const classes = CHIP_CLASSES[variant] ?? CHIP_CLASSES.neutral;
  const label = entry.kind === "renewal" ? "Renovación" : "Cobro";

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.policy)}
      className={cn(
        "flex w-full flex-col gap-0 truncate rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-[var(--elevation-xs)] transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-[var(--elevation-sm)]",
        classes.border,
        classes.bg,
        classes.text,
      )}
    >
      <span className="truncate text-[10.5px] font-semibold leading-tight">{label}</span>
      <span className="truncate text-[10px] leading-tight opacity-80">{entry.policy.contactName}</span>
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
  entries: PolicyCalendarEntry[];
  expanded: boolean;
  onToggleExpand: () => void;
  onOpen: (policy: PolicyListItem) => void;
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
        {visible.map((entry) => (
          <EntryChip key={entry.id} entry={entry} onOpen={onOpen} />
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

/** Vista Calendario de Pólizas — grilla mensual (lunes a domingo, mismos
 * helpers que el Calendario global: getMonday/addDays de calendar/week.ts)
 * puramente derivada de las pólizas ya cargadas/filtradas (mismo dataset que
 * Tabla y Kanban — buildPolicyCalendarEntries en src/lib/policies/calendarEntries.ts
 * no hace ninguna query nueva). De solo lectura: sin drag-and-drop ni
 * selección múltiple, a diferencia del MonthView del Calendario global —
 * acá no hay una fila real en `bookings` que mover. Clic en un marcador abre
 * el mismo drawer de detalle que Tabla/Kanban. */
export function PolicyCalendarView({ policies, onOpen }: { policies: PolicyListItem[]; onOpen: (policy: PolicyListItem) => void }) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const entriesByDay = useMemo(() => {
    const map = new Map<string, PolicyCalendarEntry[]>();
    for (const entry of buildPolicyCalendarEntries(policies)) {
      const key = dayKey(parseLocalDate(entry.date));
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [policies]);

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
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sin fechas para mostrar"
        description="Ninguna de las pólizas visibles tiene fecha de vencimiento cargada."
      />
    );
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
