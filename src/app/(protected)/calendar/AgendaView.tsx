"use client";

import { cn } from "@/lib/utils/cn";
import type { CalendarEvent } from "@/lib/calendar/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { CalendarDays } from "lucide-react";
import { EVENT_TYPE_META } from "@/components/calendar/eventTypeMeta";

function formatDayHeader(iso: string) {
  return new Date(iso).toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "long" });
}

function formatTimeRange(startIso: string, endIso: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${new Date(startIso).toLocaleTimeString("es", opts)} – ${new Date(endIso).toLocaleTimeString("es", opts)}`;
}

/** Flat chronological list grouped by date — the simplest of the 4 views,
 * no drag-and-drop (there's no spatial position to drag from/to in a list). */
export function AgendaView({ events, onSelect }: { events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  if (events.length === 0) {
    return (
      <div className="p-8">
        <EmptyState icon={CalendarDays} title="Sin eventos" description="No hay eventos en este rango." />
      </div>
    );
  }

  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = new Date(event.startTime).toDateString();
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  return (
    <div className="flex flex-col gap-8 p-5 sm:p-8">
      {[...groups.entries()].map(([key, dayEvents]) => (
        <div key={key}>
          <h3 className="mb-3 text-[13px] font-semibold capitalize text-neutral-500">{formatDayHeader(dayEvents[0].startTime)}</h3>
          <ul className="flex flex-col gap-2.5">
            {dayEvents.map((event) => {
              const meta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other;
              const isCancelled = event.status === "cancelled";
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(event)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-xl border-l-[3px] bg-surface-1 px-4 py-3.5 text-left shadow-[var(--elevation-xs)] transition-all duration-150",
                      "hover:-translate-y-0.5 hover:shadow-[var(--elevation-sm)]",
                      isCancelled ? "border-l-neutral-300" : meta.border,
                    )}
                  >
                    <div className="w-[92px] shrink-0 text-[13px] font-medium text-neutral-500">{formatTimeRange(event.startTime, event.endTime)}</div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-[14px] font-semibold", isCancelled ? "text-neutral-400 line-through" : "text-foreground")}>
                        {event.title}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-neutral-500">
                        <span className={cn("mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10.5px] font-medium", meta.bg, meta.text)}>{meta.label}</span>
                        {event.contactName && event.contactName}
                        {event.contactCompany && ` · ${event.contactCompany}`}
                      </p>
                    </div>
                    {event.assignedTo && (
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <Avatar name={event.assignedTo.fullName} size={26} />
                        <span className="max-w-[110px] truncate text-[12.5px] text-neutral-500">{event.assignedTo.fullName}</span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
