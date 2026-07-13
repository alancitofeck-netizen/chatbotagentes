"use client";

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { cn } from "@/lib/utils/cn";
import type { CalendarEvent } from "@/lib/calendar/queries";
import { EVENT_TYPE_META } from "@/components/calendar/eventTypeMeta";
import { moveEvent } from "@/lib/calendar/actions";
import { addDays, getMonday } from "@/lib/calendar/week";

const MAX_VISIBLE_PER_DAY = 3;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function EventChip({ event, onSelect }: { event: CalendarEvent; onSelect: (event: CalendarEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: event.id });
  const meta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other;
  const isCancelled = event.status === "cancelled";

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={() => !isDragging && onSelect(event)}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, zIndex: isDragging ? 20 : undefined }}
      className={cn(
        "flex w-full flex-col gap-0 truncate rounded-md border-l-[3px] px-1.5 py-1 text-left shadow-[var(--elevation-xs)] transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-[var(--elevation-sm)]",
        isCancelled ? "border-l-neutral-300 bg-surface-3 text-neutral-400 line-through" : cn(meta.border, meta.bg, meta.text),
        isDragging && "opacity-80 shadow-[var(--elevation-md)]",
      )}
    >
      <span className="truncate text-[11px] font-semibold leading-tight">{event.title}</span>
      <span className="truncate text-[10px] leading-tight opacity-70">{formatTime(event.startTime)}</span>
    </button>
  );
}

function DayCell({
  day,
  inMonth,
  events,
  onSelect,
  onOpenDay,
}: {
  day: Date;
  inMonth: boolean;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onOpenDay: (day: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day), data: { day } });
  const isToday = isSameDay(day, new Date());
  const visible = events.slice(0, MAX_VISIBLE_PER_DAY);
  const overflow = events.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[124px] flex-col gap-1.5 border-b border-l border-border-default p-2 transition-colors",
        !inMonth && "bg-surface-2/40",
        isOver && "bg-accent-100/50",
      )}
    >
      <button
        type="button"
        onClick={() => onOpenDay(day)}
        className={cn(
          "self-start rounded-full px-2 text-[12px] font-semibold hover:bg-surface-2",
          isToday ? "bg-accent-500 text-white hover:bg-accent-600" : inMonth ? "text-foreground" : "text-neutral-400",
        )}
      >
        {day.getDate()}
      </button>
      <div className="flex flex-col gap-1">
        {visible.map((event) => (
          <EventChip key={event.id} event={event} onSelect={onSelect} />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => onOpenDay(day)}
            className="px-1.5 text-left text-[11px] font-medium text-neutral-400 hover:text-accent-600"
          >
            +{overflow} más
          </button>
        )}
      </div>
    </div>
  );
}

/** 6×7 grid (Monday-start, matching the rest of the app's week convention —
 * src/lib/calendar/week.ts). Drag-and-drop moves an event to a different day
 * while preserving its time-of-day and duration. */
export function MonthView({
  monthDate,
  events,
  onSelect,
  onOpenDay,
  onChanged,
}: {
  monthDate: Date;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onOpenDay: (day: Date) => void;
  onChanged: () => void;
}) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = getMonday(firstOfMonth);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // See TimeGrid.tsx: without this, PointerSensor's preventDefault() on
  // pointerdown suppresses the click event a plain (non-drag) tap relies on.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(dragEvent: DragEndEvent) {
    const eventId = dragEvent.active.id as string;
    const overDay = dragEvent.over?.data.current?.day as Date | undefined;
    const moved = events.find((e) => e.id === eventId);
    if (!moved || !overDay) return;

    const originalStart = new Date(moved.startTime);
    const originalEnd = new Date(moved.endTime);
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    if (isSameDay(overDay, originalStart)) return;

    const newStart = new Date(overDay);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);
    moveEvent(eventId, newStart.toISOString(), newEnd.toISOString()).then(onChanged);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-7 border-t border-r border-border-default">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
          <div key={label} className="border-l border-border-default bg-surface-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {label}
          </div>
        ))}
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            day={day}
            inMonth={day.getMonth() === monthDate.getMonth()}
            events={events.filter((e) => isSameDay(new Date(e.startTime), day))}
            onSelect={onSelect}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </DndContext>
  );
}
