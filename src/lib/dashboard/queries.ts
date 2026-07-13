import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ChartRange = "today" | "7d" | "30d" | "90d";

function rangeStart(range: ChartRange): Date {
  const now = new Date();
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    start.setDate(start.getDate() - days);
  }
  return start;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface DashboardKpis {
  leadsToday: number;
  leadsYesterday: number;
  conversationsActive: number;
  conversationsUnread: number;
  conversationsWaiting: number;
  meetingsToday: number;
  nextMeeting: { subject: string | null; startTime: string; contactName: string } | null;
  salesThisMonth: number;
  conversionRate: number;
}

export async function getDashboardKpis(workspaceId: string): Promise<DashboardKpis> {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const tomorrowStart = addDays(todayStart, 1);

  const [
    { count: leadsToday },
    { count: leadsYesterday },
    { count: conversationsActive },
    { data: openConversations },
    { count: conversationsWaiting },
    { count: meetingsToday },
    { data: nextMeetingRows },
    { data: opportunitiesThisMonth },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", todayStart.toISOString()),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "open"),
    supabase
      .from("conversations")
      .select("id, messages(direction, created_at)")
      .eq("workspace_id", workspaceId)
      .eq("status", "open"),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending_human"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("start_time", todayStart.toISOString())
      .lt("start_time", tomorrowStart.toISOString())
      .neq("status", "cancelled"),
    supabase
      .from("bookings")
      .select("subject, start_time, contacts(name)")
      .eq("workspace_id", workspaceId)
      .gte("start_time", now.toISOString())
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(1),
    supabase
      .from("opportunities")
      .select("value, status")
      .eq("workspace_id", workspaceId)
      .gte("created_at", monthStart.toISOString()),
  ]);

  // "No leídas": la conversación está abierta y el último mensaje es del contacto
  // (nadie respondió todavía) — ver src/lib/dashboard/queries.ts para el resto de KPIs.
  let conversationsUnread = 0;
  for (const conv of openConversations ?? []) {
    const msgs = (conv.messages ?? []) as { direction: string; created_at: string }[];
    if (msgs.length === 0) continue;
    const last = msgs.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    if (last.direction === "inbound") conversationsUnread += 1;
  }

  const nextMeetingRow = nextMeetingRows?.[0] as
    | { subject: string | null; start_time: string; contacts: { name: string } | { name: string }[] | null }
    | undefined;
  const nextMeetingContact = Array.isArray(nextMeetingRow?.contacts)
    ? nextMeetingRow?.contacts[0]
    : nextMeetingRow?.contacts;

  const won = (opportunitiesThisMonth ?? []).filter((o) => o.status === "won");
  const salesThisMonth = won.reduce((sum, o) => sum + Number(o.value ?? 0), 0);
  const conversionRate =
    (opportunitiesThisMonth?.length ?? 0) > 0
      ? Math.round((won.length / (opportunitiesThisMonth?.length ?? 1)) * 1000) / 10
      : 0;

  return {
    leadsToday: leadsToday ?? 0,
    leadsYesterday: leadsYesterday ?? 0,
    conversationsActive: conversationsActive ?? 0,
    conversationsUnread,
    conversationsWaiting: conversationsWaiting ?? 0,
    meetingsToday: meetingsToday ?? 0,
    nextMeeting: nextMeetingRow
      ? {
          subject: nextMeetingRow.subject,
          startTime: nextMeetingRow.start_time,
          contactName: nextMeetingContact?.name ?? "Sin nombre",
        }
      : null,
    salesThisMonth,
    conversionRate,
  };
}

export interface ActivityPoint {
  date: string; // ISO day (or hour for "today")
  label: string;
  mensajes: number;
  leads: number;
  reuniones: number;
  ventas: number;
}

export async function getActivitySeries(workspaceId: string, range: ChartRange): Promise<ActivityPoint[]> {
  const supabase = await createClient();
  const start = rangeStart(range);

  const [{ data: messages }, { data: contacts }, { data: bookings }, { data: opportunities }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", start.toISOString()),
      supabase
        .from("contacts")
        .select("created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", start.toISOString()),
      supabase
        .from("bookings")
        .select("start_time")
        .eq("workspace_id", workspaceId)
        .gte("start_time", start.toISOString()),
      supabase
        .from("opportunities")
        .select("created_at, value, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "won")
        .gte("created_at", start.toISOString()),
    ]);

  const hourly = range === "today";
  const bucketKey = (iso: string) => {
    const d = new Date(iso);
    if (hourly) {
      d.setMinutes(0, 0, 0);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    return d.toISOString();
  };

  const buckets = new Map<string, ActivityPoint>();
  const bucketCount = hourly ? 24 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const stepMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const rangeStartTime = hourly ? startOfDay(new Date()).getTime() : start.getTime();

  for (let i = 0; i < bucketCount; i++) {
    const d = new Date(rangeStartTime + i * stepMs);
    const key = bucketKey(d.toISOString());
    buckets.set(key, {
      date: key,
      label: hourly
        ? d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" }),
      mensajes: 0,
      leads: 0,
      reuniones: 0,
      ventas: 0,
    });
  }

  for (const m of messages ?? []) {
    const key = bucketKey(m.created_at);
    const bucket = buckets.get(key);
    if (bucket) bucket.mensajes += 1;
  }
  for (const c of contacts ?? []) {
    const key = bucketKey(c.created_at);
    const bucket = buckets.get(key);
    if (bucket) bucket.leads += 1;
  }
  for (const b of bookings ?? []) {
    const key = bucketKey(b.start_time);
    const bucket = buckets.get(key);
    if (bucket) bucket.reuniones += 1;
  }
  for (const o of opportunities ?? []) {
    const key = bucketKey(o.created_at);
    const bucket = buckets.get(key);
    if (bucket) bucket.ventas += Number(o.value ?? 0);
  }

  return Array.from(buckets.values());
}

export interface RecentConversation {
  id: string;
  contactName: string;
  avatarUrl: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  status: string;
}

export async function getRecentConversations(workspaceId: string, limit = 6): Promise<RecentConversation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, contacts(name, avatar_url), messages(content, created_at, type)")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const msgs = (row.messages ?? []) as { content: { body?: string }; created_at: string; type: string }[];
    const last = msgs.length ? msgs.reduce((a, b) => (a.created_at > b.created_at ? a : b)) : null;
    return {
      id: row.id as string,
      contactName: contact?.name ?? "Sin nombre",
      avatarUrl: contact?.avatar_url ?? null,
      lastMessagePreview: last?.content?.body ?? (last ? `[${last.type}]` : "Sin mensajes"),
      lastMessageAt: row.last_message_at as string | null,
      status: row.status as string,
    };
  });
}

export interface PendingTask {
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
  status: string;
  assignedToName: string | null;
}

/** Extended (priority/status/assignee) for the now-interactive Dashboard
 * card — still filters to not-completed and orders/limits the same as
 * before, just resolves a bit more per row. `status != 'completed'` replaces
 * the old `completed_at is null` check now that status is the source of
 * truth (they're kept in sync by src/lib/tasks/actions.ts on every write). */
export async function getPendingTasks(workspaceId: string, limit = 6): Promise<PendingTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_at, priority, status, assigned_to")
    .eq("workspace_id", workspaceId)
    .neq("status", "completed")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  const rows = data ?? [];
  const memberIds = [...new Set(rows.map((r) => r.assigned_to as string | null).filter((id): id is string => Boolean(id)))];
  const { data: memberNames } = memberIds.length
    ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId })
    : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>(
    (memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]),
  );

  return rows.map((t) => ({
    id: t.id as string,
    title: t.title as string,
    dueAt: t.due_at as string | null,
    priority: t.priority as string,
    status: t.status as string,
    assignedToName: t.assigned_to ? (nameByMember.get(t.assigned_to as string) ?? null) : null,
  }));
}

export interface LeadSource {
  source: string;
  count: number;
}

/** Same "group in JS, no new table" approach as getCompanyGroups
 * (src/lib/contacts/queries.ts) — contacts.source is free text, no need for
 * a dedicated aggregate query/view. */
export async function getLeadsBySource(workspaceId: string): Promise<LeadSource[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("source")
    .eq("workspace_id", workspaceId)
    .not("source", "is", null)
    .neq("source", "");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const source = (row.source as string).trim();
    if (!source) continue;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export interface TopOpportunity {
  id: string;
  title: string;
  value: number;
  currency: string;
  contactName: string;
  stageName: string | null;
}

export async function getTopOpportunities(workspaceId: string, limit = 5): Promise<TopOpportunity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("id, title, value, currency, contacts(name), pipeline_item_id, pipeline_items(stage_id, pipeline_stages(name))")
    .eq("workspace_id", workspaceId)
    .order("value", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const pipelineItem = Array.isArray(row.pipeline_items) ? row.pipeline_items[0] : row.pipeline_items;
    const stage = pipelineItem
      ? Array.isArray(pipelineItem.pipeline_stages)
        ? pipelineItem.pipeline_stages[0]
        : pipelineItem.pipeline_stages
      : null;
    return {
      id: row.id as string,
      title: row.title as string,
      value: Number(row.value ?? 0),
      currency: row.currency as string,
      contactName: contact?.name ?? "Sin nombre",
      stageName: stage?.name ?? null,
    };
  });
}
