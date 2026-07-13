"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, requireUser } from "@/lib/auth/session";
import { getWeekBookings } from "@/lib/calendar/queries";

export async function getWeekBookingsAction(weekStartISO: string, weekEndISO: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getWeekBookings(workspaceId, weekStartISO, weekEndISO);
}

/** provider is always "internal" here — HighLevel sync isn't connected yet
 * (docs/blueprint/08-integrations.md), same deferral already made for Contacts. */
export async function createBooking(input: {
  contactId: string;
  subject: string;
  startTime: string;
  endTime: string;
}): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  if (!input.contactId) throw new Error("Seleccioná un contacto.");
  if (!(new Date(input.endTime) > new Date(input.startTime))) {
    throw new Error("El horario de fin debe ser posterior al de inicio.");
  }
  const supabase = await createClient();

  // owner_id attributes the meeting to the creating agent (src/lib/agents/
  // queries.ts uses it for "reuniones agendadas/realizadas" per agent).
  const user = await requireUser();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      workspace_id: workspaceId,
      contact_id: input.contactId,
      owner_id: member?.id ?? null,
      subject: input.subject.trim() || null,
      start_time: input.startTime,
      end_time: input.endTime,
      provider: "internal",
      status: "scheduled",
    })
    .select("id")
    .single();

  if (error || !booking) throw new Error("No se pudo agendar la reunión.");
  revalidatePath("/calendar");
  return { id: booking.id as string };
}

/** Only touches time/subject — status is left untouched (see plan's scope
 * note: 'rescheduled'/'completed' aren't actively driven by this version). */
export async function updateBooking(
  bookingId: string,
  input: { subject: string; startTime: string; endTime: string },
) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(new Date(input.endTime) > new Date(input.startTime))) {
    throw new Error("El horario de fin debe ser posterior al de inicio.");
  }
  const supabase = await createClient();

  await supabase
    .from("bookings")
    .update({
      subject: input.subject.trim() || null,
      start_time: input.startTime,
      end_time: input.endTime,
    })
    .eq("id", bookingId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/calendar");
}

export async function cancelBooking(bookingId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("workspace_id", workspaceId);

  revalidatePath("/calendar");
}
