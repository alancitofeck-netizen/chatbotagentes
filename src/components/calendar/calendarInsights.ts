import type { CalendarEvent } from "@/lib/calendar/queries";

/** Deterministic calendar math — no LLM call, no new AI dependency. Every
 * one of these ("huecos libres", "conflictos", "reuniones consecutivas") is
 * plain interval arithmetic over the events already fetched for the visible
 * range, not something that benefits from an actual model call. */

const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 18;

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function realEvents(events: CalendarEvent[], day: Date): CalendarEvent[] {
  // "task"-typed bookings are Calendar's own "Tarea" category (not a real
  // meeting) and cancelled events don't occupy real time — both excluded
  // from busy/free math, same exclusion rule already used for the sidebar's
  // "próximo evento" in CalendarShell.tsx.
  return events
    .filter((e) => e.eventType !== "task" && e.status !== "cancelled" && isSameDay(new Date(e.startTime), day))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export interface DaySummary {
  busyMinutes: number;
  freeMinutes: number;
  meetingCount: number;
}

/** Busy/free split against a fixed 9–18 workday window — a real per-user
 * working-hours concept doesn't exist in this data model yet (that's the
 * "Disponibilidad de Agenda" feature the user put on hold), so this is a
 * reasonable fixed default rather than nothing. */
export function computeDaySummary(events: CalendarEvent[], day: Date): DaySummary {
  const dayEvents = realEvents(events, day);
  const workStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORKDAY_START_HOUR, 0);
  const workEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORKDAY_END_HOUR, 0);
  const workdayMinutes = (workEnd.getTime() - workStart.getTime()) / 60000;

  let busyMinutes = 0;
  for (const e of dayEvents) {
    const start = Math.max(new Date(e.startTime).getTime(), workStart.getTime());
    const end = Math.min(new Date(e.endTime).getTime(), workEnd.getTime());
    if (end > start) busyMinutes += (end - start) / 60000;
  }

  return {
    busyMinutes: Math.round(busyMinutes),
    freeMinutes: Math.max(0, Math.round(workdayMinutes - busyMinutes)),
    meetingCount: dayEvents.length,
  };
}

export interface CalendarGap {
  startTime: string;
  endTime: string;
  minutes: number;
}

export interface CalendarConflict {
  a: CalendarEvent;
  b: CalendarEvent;
}

export interface DayInsights {
  gaps: CalendarGap[];
  conflicts: CalendarConflict[];
  /** Two or more meetings back-to-back (no gap at all) — the "tiempo muerto
   * cero entre reuniones" signal the spec asked to detect. */
  backToBackCount: number;
}

const MIN_GAP_MINUTES = 30;

export function computeDayInsights(events: CalendarEvent[], day: Date): DayInsights {
  const dayEvents = realEvents(events, day);
  const gaps: CalendarGap[] = [];
  const conflicts: CalendarConflict[] = [];
  let backToBackCount = 0;

  for (let i = 0; i < dayEvents.length - 1; i++) {
    const current = dayEvents[i];
    const next = dayEvents[i + 1];
    const currentEnd = new Date(current.endTime).getTime();
    const nextStart = new Date(next.startTime).getTime();
    const diffMinutes = (nextStart - currentEnd) / 60000;

    if (diffMinutes < 0) {
      conflicts.push({ a: current, b: next });
    } else if (diffMinutes === 0) {
      backToBackCount++;
    } else if (diffMinutes >= MIN_GAP_MINUTES) {
      gaps.push({ startTime: current.endTime, endTime: next.startTime, minutes: Math.round(diffMinutes) });
    }
  }

  return { gaps, conflicts, backToBackCount };
}
