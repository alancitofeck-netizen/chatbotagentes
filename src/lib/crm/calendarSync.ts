import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/calendar/queries";
import { pushEventToGoogle, deleteEventFromGoogle } from "@/lib/integrations/googleCalendar";

// A representative time-of-day for the auto-generated event — bookings.
// start_time/end_time are `timestamptz not null` with no "all day" concept
// anywhere in the Calendar UI (TimeGrid/MonthView/AgendaView all assume a
// real, timed duration), so "25/07/2026" becomes a 30-minute placeholder at
// this hour in the workspace's local time rather than a genuine all-day
// event — adding all-day rendering support is a separate, bigger feature.
const CLOSE_EVENT_HOUR = 9;
const CLOSE_EVENT_DURATION_MINUTES = 30;

function closeEventWindow(dateOnly: string): { start: string; end: string } {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const start = new Date(y, m - 1, d, CLOSE_EVENT_HOUR, 0, 0, 0);
  const end = new Date(start.getTime() + CLOSE_EVENT_DURATION_MINUTES * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export interface CloseDateSyncInput {
  workspaceId: string;
  opportunityId: string;
  calendarEventId: string | null;
  contactId: string | null;
  contactName: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  stageName: string;
  value: number;
  currency: string;
  ownerId: string | null;
  ownerName: string | null;
  expectedCloseDate: string | null; // "YYYY-MM-DD" or null
  isWon: boolean;
  isLost: boolean;
}

function buildDescription(input: CloseDateSyncInput): string {
  const lines = [
    `Nombre: ${input.contactName}`,
    input.company ? `Empresa: ${input.company}` : null,
    input.phone ? `Teléfono: ${input.phone}` : null,
    input.email ? `Email: ${input.email}` : null,
    `Etapa actual: ${input.stageName}`,
    `Valor del negocio: ${formatCurrency(input.value, input.currency)}`,
    `Responsable: ${input.ownerName ?? "Sin asignar"}`,
    `Link al lead: /crm?tab=board&opportunity=${input.opportunityId}`,
  ];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}

function statusFor(input: CloseDateSyncInput): "scheduled" | "completed" | "cancelled" {
  if (input.isWon) return "completed";
  if (input.isLost) return "cancelled";
  return "scheduled";
}

/** Keeps a single, dedicated `bookings` row in sync with an opportunity's
 * `expected_close_date` — creates it the first time a close date is set,
 * updates it on every subsequent edit/stage change, and removes it if the
 * date is cleared. This is the one function that owns
 * `opportunities.calendar_event_id`; callers (createOpportunity/
 * updateOpportunity in src/lib/crm/actions.ts) just pass the current state
 * and persist the returned id back onto the opportunity.
 *
 * Deliberately writes directly to `bookings` instead of going through
 * src/lib/calendar/actions.ts's createEvent/updateEvent — those resolve
 * `assignedTo` from the *current session's* role (whoever is dragging the
 * card), which is wrong here: this event must be owned by the opportunity's
 * actual `owner_id`, regardless of who happens to be editing it. Google
 * Calendar sync is preserved anyway by calling pushEventToGoogle/
 * deleteEventFromGoogle directly, same as googleCalendar.ts's own
 * importGoogleEvents does when it writes to `bookings` outside the action
 * layer. Never throws — a sync failure must not block saving the
 * opportunity itself (same resilience posture as every other
 * integration side-effect in this codebase). */
export async function syncCloseDateEvent(input: CloseDateSyncInput): Promise<string | null> {
  const supabase = await createClient();

  try {
    if (!input.expectedCloseDate) {
      if (!input.calendarEventId) return null;
      const existing = await getEventById(input.workspaceId, input.calendarEventId);
      await supabase.from("bookings").delete().eq("id", input.calendarEventId).eq("workspace_id", input.workspaceId);
      // Checking `externalId` (not `provider === 'google'`) — this event's
      // provider stays 'internal' forever even after pushEventToGoogle sets
      // its external_id (push only ever writes external_id, never flips
      // provider), so the provider check alone would silently skip Google
      // cleanup for the vast majority of these events, which get pushed
      // right after creation.
      if (existing?.externalId) void deleteEventFromGoogle(input.workspaceId, existing);
      await supabase.from("opportunities").update({ calendar_event_id: null }).eq("id", input.opportunityId);
      return null;
    }

    const { start, end } = closeEventWindow(input.expectedCloseDate);
    const title = `Cierre estimado - ${input.contactName}`;
    const description = buildDescription(input);
    const status = statusFor(input);

    if (input.calendarEventId) {
      await supabase
        .from("bookings")
        .update({
          contact_id: input.contactId,
          owner_id: input.ownerId,
          subject: title,
          description,
          event_type: "estimated_close",
          start_time: start,
          end_time: end,
          status,
          related_type: "opportunity",
          related_id: input.opportunityId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.calendarEventId)
        .eq("workspace_id", input.workspaceId);

      const fresh = await getEventById(input.workspaceId, input.calendarEventId);
      if (fresh) void pushEventToGoogle(input.workspaceId, fresh);
      return input.calendarEventId;
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        workspace_id: input.workspaceId,
        contact_id: input.contactId,
        owner_id: input.ownerId,
        subject: title,
        description,
        event_type: "estimated_close",
        start_time: start,
        end_time: end,
        status,
        provider: "internal",
        related_type: "opportunity",
        related_id: input.opportunityId,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error(`[crm-calendar-sync] failed to create event for opportunity ${input.opportunityId}:`, error);
      return null;
    }

    const newEventId = data.id as string;
    await supabase.from("opportunities").update({ calendar_event_id: newEventId }).eq("id", input.opportunityId);

    const fresh = await getEventById(input.workspaceId, newEventId);
    if (fresh) void pushEventToGoogle(input.workspaceId, fresh);
    return newEventId;
  } catch (err) {
    console.error(`[crm-calendar-sync] sync threw for opportunity ${input.opportunityId}:`, err);
    return input.calendarEventId;
  }
}

/** Lighter-weight status-only patch for the drag-and-drop stage-change path
 * (moveOpportunityCard/bulkMoveOpportunities) — those don't touch the close
 * date itself, just won/lost, so there's no need to rebuild the title/
 * description/dates on every card drag. */
export async function updateCloseEventStatus(workspaceId: string, calendarEventId: string, isWon: boolean, isLost: boolean): Promise<void> {
  try {
    const status = isWon ? "completed" : isLost ? "cancelled" : "scheduled";
    const supabase = await createClient();
    await supabase
      .from("bookings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", calendarEventId)
      .eq("workspace_id", workspaceId);
  } catch (err) {
    console.error(`[crm-calendar-sync] status update threw for event ${calendarEventId}:`, err);
  }
}

/** Called from deleteOpportunity — an opportunity's dedicated close-date
 * event has no reason to exist once the opportunity itself is gone. */
export async function deleteCloseDateEvent(workspaceId: string, calendarEventId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const existing = await getEventById(workspaceId, calendarEventId);
    await supabase.from("bookings").delete().eq("id", calendarEventId).eq("workspace_id", workspaceId);
    // See the identical comment in syncCloseDateEvent above — externalId,
    // not provider, is the real signal that a Google-side copy exists.
    if (existing?.externalId) void deleteEventFromGoogle(workspaceId, existing);
  } catch (err) {
    console.error(`[crm-calendar-sync] delete threw for event ${calendarEventId}:`, err);
  }
}
