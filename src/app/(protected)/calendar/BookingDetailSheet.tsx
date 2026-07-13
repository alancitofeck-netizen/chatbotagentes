"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { CalendarBooking } from "@/lib/calendar/queries";
import { cancelBooking, updateBooking } from "@/lib/calendar/actions";
import { toDatetimeLocalValue } from "@/lib/calendar/week";

/** `booking` arrives already fully loaded (WeekGrid passes the row it
 * already has, no async fetch) so there's no loading→loaded race to guard
 * against — unlike ContactDetailPanel, which had to remount on that
 * transition (see [[growthlink-project-state]]). The Sheet itself fully
 * unmounts its children between different bookings, so local state below
 * always initializes fresh. */
export function BookingDetailSheet({
  booking,
  onClose,
  onChanged,
}: {
  booking: CalendarBooking | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!booking) return null;
  return (
    <BookingDetailContent key={booking.id} booking={booking} onClose={onClose} onChanged={onChanged} />
  );
}

function BookingDetailContent({
  booking,
  onClose,
  onChanged,
}: {
  booking: CalendarBooking;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [subject, setSubject] = useState(booking.subject ?? "");
  const [startValue, setStartValue] = useState(toDatetimeLocalValue(booking.startTime));
  const [endValue, setEndValue] = useState(toDatetimeLocalValue(booking.endTime));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateBooking(booking.id, {
          subject,
          startTime: new Date(startValue).toISOString(),
          endTime: new Date(endValue).toISOString(),
        });
        toast.success("Reunión actualizada.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la reunión.");
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelBooking(booking.id);
      toast.success("Reunión cancelada.");
      onChanged();
    });
  }

  return (
    <Sheet open onClose={onClose} title={booking.contactName}>
      <div className="flex flex-col gap-4 p-5">
        <Input label="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Input
          label="Inicio"
          type="datetime-local"
          value={startValue}
          onChange={(e) => setStartValue(e.target.value)}
        />
        <Input label="Fin" type="datetime-local" value={endValue} onChange={(e) => setEndValue(e.target.value)} />
        <Button onClick={handleSave} loading={isPending}>
          Guardar cambios
        </Button>
        {booking.status !== "cancelled" && (
          <Button variant="destructive" onClick={handleCancel} loading={isPending}>
            Cancelar reunión
          </Button>
        )}
      </div>
    </Sheet>
  );
}
