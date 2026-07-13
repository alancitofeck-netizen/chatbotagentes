"use client";

import { useRef, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { cn } from "@/lib/utils/cn";
import type { CalendarEvent } from "@/lib/calendar/queries";
import { EVENT_TYPE_META } from "@/components/calendar/eventTypeMeta";
import { moveEvent } from "@/lib/calendar/actions";

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 68; // px — generous spacing so event cards have room to breathe
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const RANGE_MINUTES = (END_HOUR - START_HOUR) * 60;
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
const SNAP_MINUTES = 15;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesSinceRangeStart(date: Date, day: Date) {
  const rangeStart = new Date(day);
  rangeStart.setHours(START_HOUR, 0, 0, 0);
  return (date.getTime() - rangeStart.getTime()) / 60000;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function snap(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/** Small pointer-driven resize handle on the bottom edge of an event block —
 * dnd-kit is built for moving/reordering, not resizing, so this is plain
 * pointer events instead (no new dependency). `onLiveResize` updates the
 * visual height on every move; `onCommit` persists once, on pointer-up. */
function ResizeHandle({ onLiveResize, onCommit }: { onLiveResize: (deltaMinutes: number) => void; onCommit: () => void }) {
  const startY = useRef(0);

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.buttons !== 1) return;
    const deltaPx = e.clientY - startY.current;
    const deltaMinutes = snap((deltaPx / HOUR_HEIGHT) * 60);
    if (deltaMinutes !== 0) {
      onLiveResize(deltaMinutes);
      startY.current = e.clientY;
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    onCommit();
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100"
    >
      <div className="mx-auto mt-1 h-1 w-8 rounded-full bg-current/40" />
    </div>
  );
}

function EventBlock({
  event,
  day,
  onSelect,
  onLiveResize,
  onResizeCommit,
}: {
  event: CalendarEvent;
  day: Date;
  onSelect: (event: CalendarEvent) => void;
  onLiveResize: (eventId: string, endTime: string) => void;
  onResizeCommit: (eventId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: event.id, data: { event } });
  const meta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other;
  const today = new Date();

  const startMin = Math.min(Math.max(minutesSinceRangeStart(new Date(event.startTime), day), 0), RANGE_MINUTES);
  const endMin = Math.min(Math.max(minutesSinceRangeStart(new Date(event.endTime), day), 0), RANGE_MINUTES);
  const top = (startMin / RANGE_MINUTES) * GRID_HEIGHT;
  const height = Math.max(((endMin - startMin) / RANGE_MINUTES) * GRID_HEIGHT, 30);
  const compact = height < 46;
  const isPast = new Date(event.endTime) < today && event.status !== "cancelled";
  const isCancelled = event.status === "cancelled";

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={() => !isDragging && onSelect(event)}
      style={{
        top,
        height,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 30 : undefined,
      }}
      className={cn(
        "group absolute inset-x-1.5 overflow-hidden rounded-lg border-l-[3px] px-2.5 py-1.5 text-left shadow-[var(--elevation-xs)] transition-all duration-150 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[var(--elevation-md)]",
        isCancelled
          ? "border-l-neutral-300 bg-surface-3 text-neutral-400 line-through"
          : isPast
            ? "border-l-neutral-300 bg-surface-2 text-neutral-500"
            : cn(meta.border, meta.bg, meta.text),
        isDragging && "opacity-90 shadow-[var(--elevation-lg)]",
      )}
    >
      <div className={cn("truncate font-semibold", compact ? "text-[11px]" : "text-[12px]")}>{event.title}</div>
      {!compact && (
        <div className="mt-0.5 truncate text-[10.5px] opacity-80">
          {formatTime(event.startTime)} – {formatTime(event.endTime)}
        </div>
      )}
      {!compact && event.assignedTo && <div className="mt-0.5 truncate text-[10.5px] opacity-70">{event.assignedTo.fullName}</div>}
      {!isCancelled && (
        <ResizeHandle
          onLiveResize={(deltaMinutes) => {
            const newEnd = new Date(new Date(event.endTime).getTime() + deltaMinutes * 60000);
            if (newEnd > new Date(event.startTime)) onLiveResize(event.id, newEnd.toISOString());
          }}
          onCommit={() => onResizeCommit(event.id)}
        />
      )}
    </button>
  );
}

function NowIndicator({ day }: { day: Date }) {
  const now = new Date();
  if (!isSameDay(day, now) || now.getHours() < START_HOUR || now.getHours() >= END_HOUR) return null;
  const top = (minutesSinceRangeStart(now, day) / RANGE_MINUTES) * GRID_HEIGHT;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top }}>
      <span className="-ml-[3px] size-2 rounded-full bg-error" />
      <div className="h-px flex-1 bg-error/70" />
    </div>
  );
}

function DayColumn({
  day,
  events,
  onSelect,
  onLiveResize,
  onResizeCommit,
}: {
  day: Date;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onLiveResize: (eventId: string, endTime: string) => void;
  onResizeCommit: (eventId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day), data: { day } });
  const dayIsToday = isSameDay(day, new Date());

  return (
    <div
      ref={setNodeRef}
      className={cn("relative transition-colors", dayIsToday && "bg-accent-50/30", isOver && "bg-accent-100/50")}
      style={{ height: GRID_HEIGHT }}
    >
      {HOURS.map((h) => (
        <div key={h} style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }} className="absolute inset-x-0 border-t border-border-default/60" />
      ))}
      <NowIndicator day={day} />
      {events.map((event) => (
        <EventBlock key={event.id} event={event} day={day} onSelect={onSelect} onLiveResize={onLiveResize} onResizeCommit={onResizeCommit} />
      ))}
    </div>
  );
}

/** Generalizes the old WeekGrid (7 fixed columns) to any number of days —
 * 1 day → Day view, 7 → Week view, same component either way. Drag-and-drop
 * (move between slots/days) via @dnd-kit (already installed elsewhere in the
 * app); resize via a hand-rolled pointer handle (see ResizeHandle above). */
export function TimeGrid({
  days,
  events,
  onSelect,
  onChanged,
}: {
  days: Date[];
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onChanged: () => void;
}) {
  // `events` only needs to be mirrored into local state because drag/resize
  // apply optimistic mutations on top of it — rather than an effect to keep
  // them in sync (flagged by react-hooks/set-state-in-effect), the parent
  // (CalendarShell) remounts this component via a `key` tied to the visible
  // date range + a refresh tick, so this initializer is always the fresh
  // prop value.
  const [localEvents, setLocalEvents] = useState(events);

  // Without a distance constraint, PointerSensor calls preventDefault() on
  // pointerdown as soon as a draggable is touched — which, per the Pointer
  // Events spec, suppresses the browser's compatibility `click` event
  // entirely, even for a stationary click. A small movement threshold lets
  // a plain click (opening the detail drawer) coexist with drag-to-move.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(dragEvent: DragEndEvent) {
    const eventId = dragEvent.active.id as string;
    const overDay = dragEvent.over?.data.current?.day as Date | undefined;
    const moved = localEvents.find((e) => e.id === eventId);
    if (!moved) return;

    const originalStart = new Date(moved.startTime);
    const originalEnd = new Date(moved.endTime);
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    const originalDay = days.find((d) => isSameDay(d, originalStart)) ?? originalStart;
    const targetDay = overDay ?? originalDay;

    const deltaMinutes = snap((dragEvent.delta.y / HOUR_HEIGHT) * 60);
    const newStart = new Date(targetDay);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    newStart.setMinutes(newStart.getMinutes() + deltaMinutes);
    const newEnd = new Date(newStart.getTime() + durationMs);

    // No actual movement (same day, delta rounds to 0) — skip the write.
    if (newStart.getTime() === originalStart.getTime()) return;

    setLocalEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, startTime: newStart.toISOString(), endTime: newEnd.toISOString() } : e)),
    );
    moveEvent(eventId, newStart.toISOString(), newEnd.toISOString()).then(onChanged);
  }

  function handleLiveResize(eventId: string, endTime: string) {
    setLocalEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, endTime } : e)));
  }

  function handleResizeCommit(eventId: string) {
    const event = localEvents.find((e) => e.id === eventId);
    if (!event) return;
    moveEvent(eventId, event.startTime, event.endTime).then(onChanged);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex min-w-[900px]">
        <div className="w-16 shrink-0 pt-[49px]">
          {HOURS.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="pr-3 text-right text-[11px] font-medium text-neutral-400">
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day) => {
            const dayIsToday = isSameDay(day, new Date());
            const dayEvents = localEvents.filter((e) => isSameDay(new Date(e.startTime), day));
            return (
              <div key={day.toISOString()} className="border-l border-border-default">
                <div
                  className={cn(
                    "flex h-12 flex-col items-center justify-center gap-0.5 border-b border-border-default text-xs",
                    dayIsToday ? "text-accent-600" : "text-neutral-500",
                  )}
                >
                  <span className="capitalize">{day.toLocaleDateString("es", { weekday: "short" })}</span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[13px] font-semibold",
                      dayIsToday ? "bg-accent-500 text-white" : "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <DayColumn day={day} events={dayEvents} onSelect={onSelect} onLiveResize={handleLiveResize} onResizeCommit={handleResizeCommit} />
              </div>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
