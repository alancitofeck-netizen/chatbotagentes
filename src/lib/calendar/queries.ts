import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CalendarBooking {
  id: string;
  contactId: string;
  contactName: string;
  subject: string | null;
  startTime: string;
  endTime: string;
  status: "scheduled" | "rescheduled" | "cancelled" | "completed";
}

/** Bookings are read-only elsewhere today (Dashboard KPIs) — this is the
 * first query that scopes them to a date range for the Calendar grid. */
export async function getWeekBookings(
  workspaceId: string,
  weekStartISO: string,
  weekEndISO: string,
): Promise<CalendarBooking[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, contact_id, subject, start_time, end_time, status, contacts(name)")
    .eq("workspace_id", workspaceId)
    .gte("start_time", weekStartISO)
    .lt("start_time", weekEndISO)
    .order("start_time", { ascending: true });

  return (data ?? []).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    return {
      id: row.id as string,
      contactId: row.contact_id as string,
      contactName: contact?.name ?? "Sin nombre",
      subject: row.subject as string | null,
      startTime: row.start_time as string,
      endTime: row.end_time as string,
      status: row.status as CalendarBooking["status"],
    };
  });
}
