"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import {
  getCalendarEvents,
  getContactEvents,
  getEventById,
  getUpcomingEvents,
  type EventRelatedType,
  type EventType,
} from "@/lib/calendar/queries";
import { pushEventToGoogle, deleteEventFromGoogle } from "@/lib/integrations/googleCalendar";

const MANAGER_ROLES = ["owner", "admin"];
const MAX_RECURRENCE_INSTANCES = 52;

async function resolveAssignedTo(role: string, requestedMemberId: string, ownMemberId: string): Promise<string> {
  if (MANAGER_ROLES.includes(role)) return requestedMemberId || ownMemberId;
  return ownMemberId;
}

function revalidateEventPaths() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/contacts");
  revalidatePath("/crm");
}

export interface EventInput {
  title: string;
  description: string;
  eventType: EventType;
  startTime: string;
  endTime: string;
  timezone: string;
  location: string;
  meetingUrl: string;
  reminderMinutes: number | null;
  assignedTo: string;
  contactId: string | null;
  relatedType: EventRelatedType | null;
  relatedId: string | null;
  recurrenceRule: "daily" | "weekly" | "monthly" | null;
  /** Date-only "YYYY-MM-DD" — the last day a recurring instance may start on. */
  recurrenceEndDate: string | null;
}

/** Steps [startTime, endTime) forward by the recurrence rule, one instance
 * per step, until recurrenceEndDate (inclusive of that day) or
 * MAX_RECURRENCE_INSTANCES, whichever comes first — no RRULE engine, no
 * "edit the series" concept, each row is independent after creation. */
function buildOccurrences(startTime: string, endTime: string, rule: EventInput["recurrenceRule"], endDate: string | null) {
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const occurrences: { start: string; end: string }[] = [{ start: startTime, end: endTime }];
  if (!rule) return occurrences;

  const boundary = endDate ? new Date(`${endDate}T23:59:59`) : null;
  let cursor = new Date(startTime);

  while (occurrences.length < MAX_RECURRENCE_INSTANCES) {
    const next = new Date(cursor);
    if (rule === "daily") next.setDate(next.getDate() + 1);
    else if (rule === "weekly") next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);

    if (boundary && next > boundary) break;
    if (!boundary && occurrences.length >= 1 && rule) {
      // No end date given: cap at 12 occurrences so "repetir semanal" without
      // an end date doesn't silently create a year of meetings.
      if (occurrences.length >= 12) break;
    }

    occurrences.push({ start: next.toISOString(), end: new Date(next.getTime() + durationMs).toISOString() });
    cursor = next;
  }

  return occurrences;
}

export async function createEvent(input: EventInput): Promise<{ ids: string[] }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  if (!ownMemberId) throw new Error("No se pudo resolver tu usuario en este workspace.");

  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (!(new Date(input.endTime) > new Date(input.startTime))) {
    throw new Error("El horario de fin debe ser posterior al de inicio.");
  }

  const assignedTo = await resolveAssignedTo(role, input.assignedTo, ownMemberId);
  const occurrences = buildOccurrences(input.startTime, input.endTime, input.recurrenceRule, input.recurrenceEndDate);
  const recurrenceGroupId = occurrences.length > 1 ? crypto.randomUUID() : null;

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("bookings")
    .insert(
      occurrences.map((o) => ({
        workspace_id: workspaceId,
        contact_id: input.contactId,
        created_by: ownMemberId,
        owner_id: assignedTo,
        subject: title,
        description: input.description.trim() || null,
        event_type: input.eventType,
        start_time: o.start,
        end_time: o.end,
        timezone: input.timezone || null,
        location: input.location.trim() || null,
        meeting_url: input.meetingUrl.trim() || null,
        reminder_minutes: input.reminderMinutes,
        related_type: input.relatedType,
        related_id: input.relatedId,
        recurrence_rule: input.recurrenceRule,
        recurrence_group_id: recurrenceGroupId,
        provider: "internal",
        status: "scheduled",
      })),
    )
    .select("id");

  if (error || !inserted) throw new Error("No se pudo crear el evento.");

  const ids = inserted.map((r) => r.id as string);
  // Fire-and-forget: a Google API hiccup must never block saving the event
  // in the CRM (same resilience posture as YCloud sends — see
  // src/lib/integrations/googleCalendar.ts).
  for (const id of ids) {
    getEventById(workspaceId, id).then((event) => {
      if (event) void pushEventToGoogle(workspaceId, event);
    });
  }

  revalidateEventPaths();
  return { ids };
}

export async function updateEvent(eventId: string, input: EventInput) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const ownMemberId = await getCurrentMemberId(workspaceId);
  if (!ownMemberId) throw new Error("No se pudo resolver tu usuario en este workspace.");

  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (!(new Date(input.endTime) > new Date(input.startTime))) {
    throw new Error("El horario de fin debe ser posterior al de inicio.");
  }

  const assignedTo = await resolveAssignedTo(role, input.assignedTo, ownMemberId);
  const supabase = await createClient();

  await supabase
    .from("bookings")
    .update({
      contact_id: input.contactId,
      owner_id: assignedTo,
      subject: title,
      description: input.description.trim() || null,
      event_type: input.eventType,
      start_time: input.startTime,
      end_time: input.endTime,
      timezone: input.timezone || null,
      location: input.location.trim() || null,
      meeting_url: input.meetingUrl.trim() || null,
      reminder_minutes: input.reminderMinutes,
      related_type: input.relatedType,
      related_id: input.relatedId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("workspace_id", workspaceId);

  getEventById(workspaceId, eventId).then((event) => {
    if (event) void pushEventToGoogle(workspaceId, event);
  });

  revalidateEventPaths();
}

/** Quick move/resize from drag-and-drop — same update path but only touches
 * timing, not the rest of the form (avoids re-sending stale form state from
 * a drag gesture that never opened the edit sheet). */
export async function moveEvent(eventId: string, startTime: string, endTime: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("bookings")
    .update({ start_time: startTime, end_time: endTime, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("workspace_id", workspaceId);

  getEventById(workspaceId, eventId).then((event) => {
    if (event) void pushEventToGoogle(workspaceId, event);
  });

  revalidateEventPaths();
}

export async function cancelEvent(eventId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  await supabase
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("workspace_id", workspaceId);

  revalidateEventPaths();
}

/** Real delete (distinct from cancelEvent's soft-cancel) — owner/admin only,
 * enforced by the bookings_delete policy (0017_calendar_events.sql). */
export async function deleteEvent(eventId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const event = await getEventById(workspaceId, eventId);
  await supabase.from("bookings").delete().eq("id", eventId).eq("workspace_id", workspaceId);

  if (event?.provider === "google") void deleteEventFromGoogle(workspaceId, event);

  revalidateEventPaths();
}

export async function getCalendarEventsAction(rangeStartISO: string, rangeEndISO: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getCalendarEvents(workspaceId, rangeStartISO, rangeEndISO);
}

export async function getEventByIdAction(eventId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getEventById(workspaceId, eventId);
}

export async function getContactEventsAction(contactId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getContactEvents(workspaceId, contactId);
}

export async function getUpcomingEventsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getUpcomingEvents(workspaceId);
}
