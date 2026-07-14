import type { ToolContext } from "@/lib/ai/tools/shared";
import { crossTenantRejection } from "@/lib/ai/tools/shared";
import { DEFAULT_DURATION_MINUTES } from "@/lib/ai/tools/agendaConfig";

/** `create_appointment` — side-effecting. Inserts directly into `bookings`
 * via the service-role client, rather than reusing the session-bound
 * `createEvent` Server Action (src/lib/calendar/actions.ts), which also
 * handles recurrence and a fire-and-forget Google Calendar push through
 * `createClient()` (cookie/session-bound — would silently no-op here).
 *
 * Scope cut, flagged: AI-created appointments do NOT sync to Google Calendar
 * yet (only human-created ones do) — extending pushEventToGoogle to accept a
 * service-role client is deferred, not silently skipped. */
export async function createAppointment(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const contactId = String(args.contact_id ?? "");
  const startTimeRaw = String(args.start_time ?? "");
  const durationMinutes = typeof args.duration_minutes === "number" ? args.duration_minutes : DEFAULT_DURATION_MINUTES;
  const subject = typeof args.subject === "string" && args.subject.trim() ? args.subject.trim() : "Reunión";

  const startTime = new Date(startTimeRaw);
  if (Number.isNaN(startTime.getTime())) throw new Error("start_time must be a valid ISO 8601 datetime");
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

  const { data: contact } = await ctx.supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!contact) throw crossTenantRejection("contact_id");

  const { data: conversation } = await ctx.supabase
    .from("conversations")
    .select("assigned_user_id")
    .eq("id", ctx.conversationId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  const { data: booking, error } = await ctx.supabase
    .from("bookings")
    .insert({
      workspace_id: ctx.workspaceId,
      contact_id: contactId,
      provider: "internal",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      subject,
      status: "scheduled",
      owner_id: conversation?.assigned_user_id ?? null,
      created_by: null,
    })
    .select("id")
    .single();

  if (error || !booking) throw new Error("create_appointment_failed");

  return { bookingId: booking.id, startTime: startTime.toISOString(), endTime: endTime.toISOString() };
}
