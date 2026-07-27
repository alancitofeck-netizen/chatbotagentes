import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMonday } from "@/lib/calendar/week";

/** Same relative-change formula as src/lib/crm/queries.ts's private deltaPct
 * — re-derived locally (3 lines) rather than imported across modules, same
 * precedent already set by src/lib/crm/analyticsRange.ts's mondayOf(). */
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function weekBounds(weeksAgo: 0 | 1) {
  const start = getMonday(new Date());
  start.setDate(start.getDate() - weeksAgo * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export interface UnansweredConversation {
  id: string;
  contactName: string;
  hoursWaiting: number;
}

/** Every open/pending_human conversation whose last message is inbound —
 * i.e. genuinely waiting on a human/AI reply right now. Thresholding
 * (>6h/>24h) is the rules engine's job, not this query's — this returns the
 * full list with real ages so the engine can bucket it however it wants. */
export async function getUnansweredConversations(workspaceId: string): Promise<UnansweredConversation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, contacts(name), messages(direction, created_at)")
    .eq("workspace_id", workspaceId)
    .in("status", ["open", "pending_human"]);

  const now = Date.now();
  const result: UnansweredConversation[] = [];
  for (const row of data ?? []) {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const msgs = (row.messages ?? []) as { direction: string; created_at: string }[];
    if (msgs.length === 0) continue;
    const last = msgs.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    if (last.direction !== "inbound") continue;
    result.push({
      id: row.id as string,
      contactName: contact?.name ?? "Sin nombre",
      hoursWaiting: (now - new Date(last.created_at).getTime()) / 3_600_000,
    });
  }
  return result;
}

export interface WeekOverWeekMetric {
  current: number;
  previous: number;
  deltaPct: number | null;
}

export interface WeekOverWeekMetrics {
  connections: WeekOverWeekMetric;
  meetings: WeekOverWeekMetric;
  acceptance: WeekOverWeekMetric;
  /** Workspace-wide opportunities won this week (updated_at-bucketed, same
   * convention getCrmBoard already uses for "won this month"). */
  wonThisWeek: number;
}

export async function getWeekOverWeekMetrics(workspaceId: string): Promise<WeekOverWeekMetrics> {
  const supabase = await createClient();
  const thisWeek = weekBounds(0);
  const lastWeek = weekBounds(1);

  const [{ data: contacts }, { data: bookings }, { data: conversations }, { data: wonOpportunities }] = await Promise.all([
    supabase.from("contacts").select("created_at").eq("workspace_id", workspaceId).gte("created_at", lastWeek.start.toISOString()),
    supabase
      .from("bookings")
      .select("start_time")
      .eq("workspace_id", workspaceId)
      .neq("status", "cancelled")
      .gte("start_time", lastWeek.start.toISOString()),
    supabase
      .from("conversations")
      .select("id, created_at, messages(direction, created_at)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", lastWeek.start.toISOString()),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "won")
      .gte("updated_at", thisWeek.start.toISOString()),
  ]);

  const inWindow = (iso: string, start: Date, end: Date) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end.getTime();
  };

  const connectionsCurrent = (contacts ?? []).filter((c) => inWindow(c.created_at as string, thisWeek.start, thisWeek.end)).length;
  const connectionsPrevious = (contacts ?? []).filter((c) => inWindow(c.created_at as string, lastWeek.start, lastWeek.end)).length;

  const meetingsCurrent = (bookings ?? []).filter((b) => inWindow(b.start_time as string, thisWeek.start, thisWeek.end)).length;
  const meetingsPrevious = (bookings ?? []).filter((b) => inWindow(b.start_time as string, lastWeek.start, lastWeek.end)).length;

  // Acceptance: a conversation "attempted" if its FIRST message is outbound;
  // "accepted" if any LATER message is inbound (the contact actually replied).
  function acceptanceRate(start: Date, end: Date): number {
    let attempted = 0;
    let accepted = 0;
    for (const conv of conversations ?? []) {
      if (!inWindow(conv.created_at as string, start, end)) continue;
      const msgs = ((conv.messages ?? []) as { direction: string; created_at: string }[]).slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      if (msgs.length === 0 || msgs[0].direction !== "outbound") continue;
      attempted += 1;
      if (msgs.slice(1).some((m) => m.direction === "inbound")) accepted += 1;
    }
    return attempted > 0 ? Math.round((accepted / attempted) * 1000) / 10 : 0;
  }
  const acceptanceCurrent = acceptanceRate(thisWeek.start, thisWeek.end);
  const acceptancePrevious = acceptanceRate(lastWeek.start, lastWeek.end);

  return {
    connections: { current: connectionsCurrent, previous: connectionsPrevious, deltaPct: deltaPct(connectionsCurrent, connectionsPrevious) },
    meetings: { current: meetingsCurrent, previous: meetingsPrevious, deltaPct: deltaPct(meetingsCurrent, meetingsPrevious) },
    acceptance: { current: acceptanceCurrent, previous: acceptancePrevious, deltaPct: deltaPct(acceptanceCurrent, acceptancePrevious) },
    wonThisWeek: wonOpportunities?.length ?? 0,
  };
}

export async function getOverdueTasksCount(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .lt("due_at", new Date().toISOString())
    .neq("status", "completed");
  return count ?? 0;
}

export interface UncontactedLead {
  id: string;
  name: string;
  createdAt: string;
}

/** Contacts created within the last NEW_LEAD_WINDOW_DAYS that have zero
 * outbound messages across any of their conversations — i.e. genuinely
 * never reached out to yet. */
export async function getUncontactedLeads(workspaceId: string): Promise<UncontactedLead[]> {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", cutoff.toISOString());
  if (!contacts || contacts.length === 0) return [];

  const contactIds = contacts.map((c) => c.id as string);
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .eq("workspace_id", workspaceId)
    .in("contact_id", contactIds);
  const conversationIds = (conversations ?? []).map((c) => c.id as string);

  const { data: outboundMessages } = conversationIds.length
    ? await supabase.from("messages").select("conversation_id").in("conversation_id", conversationIds).eq("direction", "outbound")
    : { data: [] };

  const contactedConversationIds = new Set((outboundMessages ?? []).map((m) => m.conversation_id as string));
  const contactedContactIds = new Set(
    (conversations ?? []).filter((c) => contactedConversationIds.has(c.id as string)).map((c) => c.contact_id as string),
  );

  return contacts
    .filter((c) => !contactedContactIds.has(c.id as string))
    .map((c) => ({ id: c.id as string, name: c.name as string, createdAt: c.created_at as string }));
}

/** Always false today — no LinkedIn integration exists anywhere in this
 * project (confirmed: the live integration_connections_provider_check
 * constraint doesn't include 'linkedin' at all, so this can never match a
 * row until a real integration ships). A plain SELECT never trips a CHECK
 * constraint, so querying an unlisted provider value is a permanently safe
 * no-op — this keeps the LinkedIn insight slot structurally real (a genuine
 * query, not a hardcoded false) without touching any fake data. */
export async function hasLinkedInConnection(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("integration_connections")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("provider", "linkedin")
    .eq("status", "active");
  return (count ?? 0) > 0;
}
