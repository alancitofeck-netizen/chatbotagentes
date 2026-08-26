import type { ToolContext } from "@/lib/ai/tools/shared";

/** `update_appointment` — side-effecting, Agente de Citas. Mismo criterio
 * que update_referral.ts: nunca confía en un booking_id que venga del
 * modelo — resuelve la cita más reciente activa (scheduled/rescheduled)
 * del contacto actual, server-side. "Confirmar cita" no tiene acción
 * propia acá: bookings.status no distingue "confirmada" de "scheduled",
 * confirmar es solo lo que el agente dice en el chat. */
export async function updateAppointment(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const action = String(args.action ?? "");
  if (action !== "reschedule" && action !== "cancel") {
    throw new Error("action must be one of: reschedule, cancel");
  }

  const { data: booking } = await ctx.supabase
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("workspace_id", ctx.workspaceId)
    .eq("contact_id", ctx.contactId)
    .in("status", ["scheduled", "rescheduled"])
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!booking) throw new Error("no_active_appointment_found_for_contact");

  if (action === "cancel") {
    const { error } = await ctx.supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    if (error) throw new Error("update_appointment_failed");
    return { bookingId: booking.id, status: "cancelled" };
  }

  const newStartTimeRaw = String(args.new_start_time ?? "");
  const newStartTime = new Date(newStartTimeRaw);
  if (Number.isNaN(newStartTime.getTime())) throw new Error("new_start_time must be a valid ISO 8601 datetime");

  const originalDurationMs = new Date(booking.end_time as string).getTime() - new Date(booking.start_time as string).getTime();
  const newEndTime = new Date(newStartTime.getTime() + originalDurationMs);

  const { error } = await ctx.supabase
    .from("bookings")
    .update({ status: "rescheduled", start_time: newStartTime.toISOString(), end_time: newEndTime.toISOString() })
    .eq("id", booking.id);
  if (error) throw new Error("update_appointment_failed");

  return { bookingId: booking.id, status: "rescheduled", startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString() };
}
