"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CalendarBooking } from "@/lib/calendar/queries";
import { getWeekBookingsAction } from "@/lib/calendar/actions";
import { addDays, formatWeekRange, getMonday } from "@/lib/calendar/week";
import { WeekGrid } from "./WeekGrid";
import { BookingDetailSheet } from "./BookingDetailSheet";
import { CreateBookingSheet } from "./CreateBookingSheet";

export function CalendarShell({
  initialWeekStartISO,
  initialBookings,
}: {
  initialWeekStartISO: string;
  initialBookings: CalendarBooking[];
}) {
  const [weekStart, setWeekStart] = useState(() => new Date(initialWeekStartISO));
  const [bookings, setBookings] = useState(initialBookings);
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();

  function refetch(start: Date) {
    const end = addDays(start, 7);
    startTransition(async () => {
      const fresh = await getWeekBookingsAction(start.toISOString(), end.toISOString());
      setBookings(fresh);
    });
  }

  // Skip the redundant refetch on first mount — page.tsx already loaded this week.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refetch(weekStart);
  }, [weekStart]);

  function handleCreated() {
    refetch(weekStart);
  }

  function handleChanged() {
    refetch(weekStart);
    setSelectedBooking(null);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border-default px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-semibold text-foreground">Calendario</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getMonday(new Date()))}
              className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              Hoy
            </button>
            <button
              type="button"
              aria-label="Semana siguiente"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <span className="text-sm text-neutral-500">{formatWeekRange(weekStart)}</span>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          Nueva reunión
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <WeekGrid weekStart={weekStart} bookings={bookings} onSelect={setSelectedBooking} />
      </div>

      <BookingDetailSheet booking={selectedBooking} onClose={() => setSelectedBooking(null)} onChanged={handleChanged} />
      <CreateBookingSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}
