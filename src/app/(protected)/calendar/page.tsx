import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWeekBookings } from "@/lib/calendar/queries";
import { addDays, getMonday } from "@/lib/calendar/week";
import { CalendarShell } from "./CalendarShell";

export const metadata: Metadata = {
  title: "Calendario — Growth Link",
};

export default async function CalendarPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const weekStart = getMonday(new Date());
  const weekEnd = addDays(weekStart, 7);
  const bookings = await getWeekBookings(workspaceId, weekStart.toISOString(), weekEnd.toISOString());

  return <CalendarShell initialWeekStartISO={weekStart.toISOString()} initialBookings={bookings} />;
}
