import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EventType = "call" | "meeting" | "follow_up" | "demo" | "task" | "other" | "estimated_close";
export type EventStatus = "scheduled" | "rescheduled" | "cancelled" | "completed";
export type EventProvider = "internal" | "highlevel" | "google" | "calendly";
/** Same polymorphic convention as tasks.related_type (0016_tasks_enrichment.sql)
 * — 'contact' isn't included here since bookings already has a dedicated
 * `contact_id` column (a calendar event centers on a contact far more often
 * than a task does), this only covers the two extra relation targets. */
export type EventRelatedType = "conversation" | "opportunity";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: EventType;
  startTime: string;
  endTime: string;
  timezone: string | null;
  location: string | null;
  meetingUrl: string | null;
  status: EventStatus;
  provider: EventProvider;
  /** bookings.external_id — the Google Calendar event id once this row has
   * been pushed there (or the origin id if it was imported from Google). */
  externalId: string | null;
  reminderMinutes: number | null;
  contactId: string | null;
  contactName: string | null;
  contactCompany: string | null;
  assignedTo: { memberId: string; fullName: string } | null;
  createdByMemberId: string | null;
  relatedType: EventRelatedType | null;
  relatedId: string | null;
  relatedLabel: string | null;
  recurrenceRule: "daily" | "weekly" | "monthly" | null;
  recurrenceGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EventRow {
  id: string;
  /** The physical column is still `subject` (pre-existing on `bookings`,
   * 0002_crm_and_dashboard.sql) — never renamed to `title` in the DB to
   * avoid touching every existing consumer (dashboard/crm/agents queries),
   * just exposed as `title` in the app-facing CalendarEvent shape below. */
  subject: string | null;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  timezone: string | null;
  location: string | null;
  meeting_url: string | null;
  status: string;
  provider: string;
  external_id: string | null;
  reminder_minutes: number | null;
  contact_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  related_type: string | null;
  related_id: string | null;
  recurrence_rule: string | null;
  recurrence_group_id: string | null;
  created_at: string;
  updated_at: string;
  contacts: { name: string; company: string | null } | { name: string; company: string | null }[] | null;
}

const EVENT_SELECT =
  "id, subject, description, event_type, start_time, end_time, timezone, location, meeting_url, status, provider, external_id, reminder_minutes, contact_id, owner_id, created_by, related_type, related_id, recurrence_rule, recurrence_group_id, created_at, updated_at, contacts(name, company)";

async function resolveRelatedLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  rows: EventRow[],
): Promise<Map<string, string>> {
  const conversationIds = rows.filter((r) => r.related_type === "conversation" && r.related_id).map((r) => r.related_id as string);
  const opportunityIds = rows.filter((r) => r.related_type === "opportunity" && r.related_id).map((r) => r.related_id as string);
  const labelById = new Map<string, string>();

  if (conversationIds.length) {
    const { data } = await supabase
      .from("conversations")
      .select("id, contacts(name)")
      .eq("workspace_id", workspaceId)
      .in("id", conversationIds);
    for (const row of data ?? []) {
      const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
      labelById.set(row.id as string, contact ? `Conversación con ${contact.name as string}` : "Conversación");
    }
  }

  if (opportunityIds.length) {
    const { data } = await supabase.from("opportunities").select("id, title").eq("workspace_id", workspaceId).in("id", opportunityIds);
    for (const o of data ?? []) labelById.set(o.id as string, o.title as string);
  }

  return labelById;
}

async function mapEventRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  rows: EventRow[],
): Promise<CalendarEvent[]> {
  const memberIds = [...new Set(rows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))];
  const [{ data: memberNames }, relatedLabels] = await Promise.all([
    memberIds.length
      ? supabase.rpc("workspace_member_names", { ws_id: workspaceId })
      : Promise.resolve({ data: [] as { member_id: string; full_name: string }[] }),
    resolveRelatedLabels(supabase, workspaceId, rows),
  ]);
  const nameByMember = new Map<string, string>(
    (memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]),
  );

  return rows.map((r) => {
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    return {
      id: r.id,
      title: r.subject ?? "Sin título",
      description: r.description,
      eventType: (r.event_type as EventType) ?? "other",
      startTime: r.start_time,
      endTime: r.end_time,
      timezone: r.timezone,
      location: r.location,
      meetingUrl: r.meeting_url,
      status: r.status as EventStatus,
      provider: r.provider as EventProvider,
      externalId: r.external_id,
      reminderMinutes: r.reminder_minutes,
      contactId: r.contact_id,
      contactName: contact?.name ?? null,
      contactCompany: contact?.company ?? null,
      assignedTo: r.owner_id ? { memberId: r.owner_id, fullName: nameByMember.get(r.owner_id) ?? "—" } : null,
      createdByMemberId: r.created_by,
      relatedType: (r.related_type as EventRelatedType | null) ?? null,
      relatedId: r.related_id,
      relatedLabel: r.related_id ? (relatedLabels.get(r.related_id) ?? null) : null,
      recurrenceRule: (r.recurrence_rule as CalendarEvent["recurrenceRule"]) ?? null,
      recurrenceGroupId: r.recurrence_group_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

/** Range-based fetch backing all 4 views (Day/Week/Month/Agenda just pass a
 * different [rangeStart, rangeEnd)) — replaces the old week-only
 * getWeekBookings. */
export async function getCalendarEvents(workspaceId: string, rangeStartISO: string, rangeEndISO: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(EVENT_SELECT)
    .eq("workspace_id", workspaceId)
    .gte("start_time", rangeStartISO)
    .lt("start_time", rangeEndISO)
    .order("start_time", { ascending: true });

  return mapEventRows(supabase, workspaceId, (data ?? []) as EventRow[]);
}

export async function getEventById(workspaceId: string, eventId: string): Promise<CalendarEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select(EVENT_SELECT).eq("workspace_id", workspaceId).eq("id", eventId).maybeSingle();
  if (!data) return null;
  const [event] = await mapEventRows(supabase, workspaceId, [data as EventRow]);
  return event;
}

/** History + upcoming events for a contact's detail panel. */
export async function getContactEvents(workspaceId: string, contactId: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(EVENT_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .order("start_time", { ascending: false });

  return mapEventRows(supabase, workspaceId, (data ?? []) as EventRow[]);
}

/** For the Dashboard "Próximas reuniones" widget. */
export async function getUpcomingEvents(workspaceId: string, limit = 5): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(EVENT_SELECT)
    .eq("workspace_id", workspaceId)
    .gte("start_time", new Date().toISOString())
    .neq("status", "cancelled")
    .order("start_time", { ascending: true })
    .limit(limit);

  return mapEventRows(supabase, workspaceId, (data ?? []) as EventRow[]);
}
