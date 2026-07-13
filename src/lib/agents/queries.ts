import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMonday } from "@/lib/calendar/week";

const ACTIVITY_WINDOW_DAYS = 90;

export interface Team {
  id: string;
  name: string;
  leaderId: string | null;
  leaderName: string | null;
}

export async function getTeams(workspaceId: string): Promise<Team[]> {
  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, leader_id")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (!teams || teams.length === 0) return [];

  const { data: names } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  const nameByMemberId = new Map(
    ((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]),
  );

  return teams.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    leaderId: t.leader_id as string | null,
    leaderName: t.leader_id ? (nameByMemberId.get(t.leader_id as string) ?? null) : null,
  }));
}

export interface AgentListItem {
  memberId: string;
  fullName: string;
  email: string;
  role: string;
  title: string | null;
  status: "active" | "vacation" | "inactive";
  teamId: string | null;
  teamName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  hireDate: string | null;
  leadsAssigned: number;
  leadsContacted: number;
  responseRate: number;
  meetingsScheduled: number;
  meetingsCompleted: number;
  meetingsThisWeek: number;
  weeklyTarget: number | null;
  conversionRate: number;
  avgResponseMinutes: number | null;
  score: number;
  trend: number[];
  trendDirection: "up" | "down" | "flat";
  lastActivityAt: string | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Score formula confirmed explicitly with the user: 25% each of response
 * rate, conversion rate, meeting-completion rate, and response speed
 * (0 min → 100 pts, ≥60 min → 0 pts, linear). A first-pass, documented and
 * adjustable heuristic, not a validated formula from the Blueprint (this
 * feature isn't in the Blueprint at all). */
function computeScore(input: {
  responseRate: number;
  conversionRate: number;
  meetingsScheduled: number;
  meetingsCompleted: number;
  avgResponseMinutes: number | null;
}) {
  const meetingScore = input.meetingsScheduled > 0 ? (input.meetingsCompleted / input.meetingsScheduled) * 100 : 0;
  const speedScore =
    input.avgResponseMinutes === null ? 0 : clamp(100 - (input.avgResponseMinutes / 60) * 100, 0, 100);
  return Math.round(0.25 * input.responseRate + 0.25 * input.conversionRate + 0.25 * meetingScore + 0.25 * speedScore);
}

export async function getAgentList(
  workspaceId: string,
  filters: { teamId?: string; supervisorId?: string; status?: string; search?: string } = {},
): Promise<AgentListItem[]> {
  const supabase = await createClient();
  const activityStart = new Date();
  activityStart.setDate(activityStart.getDate() - ACTIVITY_WINDOW_DAYS);
  const weekStart = getMonday(new Date());
  const now = new Date();

  let memberQuery = supabase
    .from("workspace_members")
    .select("id, user_id, role, title, status, team_id, supervisor_id, hire_date")
    .eq("workspace_id", workspaceId);
  if (filters.teamId) memberQuery = memberQuery.eq("team_id", filters.teamId);
  if (filters.supervisorId) memberQuery = memberQuery.eq("supervisor_id", filters.supervisorId);
  if (filters.status) memberQuery = memberQuery.eq("status", filters.status);

  const [{ data: members }, { data: names }, { data: teams }, { data: conversations }, { data: bookings }, { data: opportunities }] =
    await Promise.all([
      memberQuery,
      supabase.rpc("workspace_member_names", { ws_id: workspaceId }),
      supabase.from("teams").select("id, name").eq("workspace_id", workspaceId),
      supabase
        .from("conversations")
        .select("id, assigned_user_id, contact_id, last_message_at")
        .eq("workspace_id", workspaceId)
        .not("assigned_user_id", "is", null),
      supabase.from("bookings").select("owner_id, start_time, end_time, status").eq("workspace_id", workspaceId),
      supabase.from("opportunities").select("owner_id, status").eq("workspace_id", workspaceId),
    ]);

  if (!members || members.length === 0) return [];

  const nameByMemberId = new Map(
    ((names ?? []) as { member_id: string; full_name: string; email: string }[]).map((n) => [
      n.member_id,
      { fullName: n.full_name, email: n.email },
    ]),
  );
  const teamNameById = new Map(((teams ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));

  const conversationsByAgent = new Map<string, { id: string; contactId: string; lastMessageAt: string | null }[]>();
  for (const c of conversations ?? []) {
    const agentId = c.assigned_user_id as string;
    const list = conversationsByAgent.get(agentId) ?? [];
    list.push({ id: c.id as string, contactId: c.contact_id as string, lastMessageAt: c.last_message_at as string | null });
    conversationsByAgent.set(agentId, list);
  }

  const conversationIds = (conversations ?? []).map((c) => c.id as string);
  const { data: messages } = conversationIds.length
    ? await supabase
        .from("messages")
        .select("conversation_id, direction, created_at")
        .in("conversation_id", conversationIds)
        .gte("created_at", activityStart.toISOString())
        .order("created_at", { ascending: true })
    : { data: [] };

  const messagesByConversation = new Map<string, { direction: string; createdAt: string }[]>();
  for (const m of messages ?? []) {
    const key = m.conversation_id as string;
    const list = messagesByConversation.get(key) ?? [];
    list.push({ direction: m.direction as string, createdAt: m.created_at as string });
    messagesByConversation.set(key, list);
  }

  const bookingsByAgent = new Map<string, { startTime: string; endTime: string; status: string }[]>();
  for (const b of bookings ?? []) {
    if (!b.owner_id) continue;
    const list = bookingsByAgent.get(b.owner_id as string) ?? [];
    list.push({ startTime: b.start_time as string, endTime: b.end_time as string, status: b.status as string });
    bookingsByAgent.set(b.owner_id as string, list);
  }

  const opportunitiesByAgent = new Map<string, { status: string }[]>();
  for (const o of opportunities ?? []) {
    if (!o.owner_id) continue;
    const list = opportunitiesByAgent.get(o.owner_id as string) ?? [];
    list.push({ status: o.status as string });
    opportunitiesByAgent.set(o.owner_id as string, list);
  }

  const { data: targets } = await supabase
    .from("agent_targets")
    .select("member_id, target_value")
    .eq("workspace_id", workspaceId)
    .eq("metric", "meetings")
    .eq("period", "week")
    .eq("period_start", weekStart.toISOString().slice(0, 10));
  const targetByMember = new Map(((targets ?? []) as { member_id: string; target_value: number }[]).map((t) => [t.member_id, t.target_value]));

  const items: AgentListItem[] = members.map((m) => {
    const memberId = m.id as string;
    const identity = nameByMemberId.get(memberId);
    const agentConversations = conversationsByAgent.get(memberId) ?? [];

    let contacted = 0;
    let replied = 0;
    const responseGapsMin: number[] = [];
    const outboundByDay = new Map<string, number>();

    for (const conv of agentConversations) {
      const msgs = messagesByConversation.get(conv.id) ?? [];
      const hasOutbound = msgs.some((msg) => msg.direction === "outbound");
      if (hasOutbound) contacted += 1;

      let gotReply = false;
      for (let i = 0; i < msgs.length; i++) {
        const day = msgs[i].createdAt.slice(0, 10);
        if (msgs[i].direction === "outbound") {
          outboundByDay.set(day, (outboundByDay.get(day) ?? 0) + 1);
        }
        if (msgs[i].direction === "inbound" && i + 1 < msgs.length && msgs[i + 1].direction === "outbound") {
          const gapMin = (new Date(msgs[i + 1].createdAt).getTime() - new Date(msgs[i].createdAt).getTime()) / 60000;
          responseGapsMin.push(gapMin);
        }
        if (hasOutbound && msgs[i].direction === "inbound") gotReply = true;
      }
      if (gotReply) replied += 1;
    }

    const responseRate = contacted > 0 ? Math.round((replied / contacted) * 1000) / 10 : 0;
    const avgResponseMinutes = responseGapsMin.length
      ? Math.round((responseGapsMin.reduce((s, v) => s + v, 0) / responseGapsMin.length) * 10) / 10
      : null;

    const agentBookings = bookingsByAgent.get(memberId) ?? [];
    const activeBookings = agentBookings.filter((b) => b.status !== "cancelled");
    const meetingsScheduled = activeBookings.length;
    const meetingsCompleted = activeBookings.filter((b) => new Date(b.endTime) < now).length;
    const meetingsThisWeek = activeBookings.filter((b) => new Date(b.startTime) >= weekStart).length;

    const agentOpportunities = opportunitiesByAgent.get(memberId) ?? [];
    const wonOpportunities = agentOpportunities.filter((o) => o.status === "won").length;
    const conversionRate =
      agentOpportunities.length > 0 ? Math.round((wonOpportunities / agentOpportunities.length) * 1000) / 10 : 0;

    const trend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trend.push(outboundByDay.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    const recentAvg = (trend[4] + trend[5] + trend[6]) / 3;
    const earlierAvg = (trend[0] + trend[1] + trend[2] + trend[3]) / 4;
    const trendDirection: "up" | "down" | "flat" =
      recentAvg > earlierAvg + 0.5 ? "up" : recentAvg < earlierAvg - 0.5 ? "down" : "flat";

    const lastActivityAt = agentConversations.reduce<string | null>((latest, c) => {
      if (!c.lastMessageAt) return latest;
      if (!latest || c.lastMessageAt > latest) return c.lastMessageAt;
      return latest;
    }, null);

    const score = computeScore({ responseRate, conversionRate, meetingsScheduled, meetingsCompleted, avgResponseMinutes });

    return {
      memberId,
      fullName: identity?.fullName ?? "Sin nombre",
      email: identity?.email ?? "",
      role: m.role as string,
      title: m.title as string | null,
      status: m.status as "active" | "vacation" | "inactive",
      teamId: m.team_id as string | null,
      teamName: m.team_id ? (teamNameById.get(m.team_id as string) ?? null) : null,
      supervisorId: m.supervisor_id as string | null,
      supervisorName: m.supervisor_id ? (nameByMemberId.get(m.supervisor_id as string)?.fullName ?? null) : null,
      hireDate: m.hire_date as string | null,
      leadsAssigned: new Set(agentConversations.map((c) => c.contactId)).size,
      leadsContacted: contacted,
      responseRate,
      meetingsScheduled,
      meetingsCompleted,
      meetingsThisWeek,
      weeklyTarget: targetByMember.get(memberId) ?? null,
      conversionRate,
      avgResponseMinutes,
      score,
      trend,
      trendDirection,
      lastActivityAt,
    };
  });

  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    return items.filter((i) => i.fullName.toLowerCase().includes(q) || i.email.toLowerCase().includes(q));
  }

  return items.sort((a, b) => b.score - a.score);
}

export interface AgentDailyPoint {
  label: string;
  messages: number;
}
export interface AgentWeeklyPoint {
  label: string;
  meetings: number;
}
export interface AgentMonthlyPoint {
  label: string;
  won: number;
}

export interface AgentActivityEvent {
  id: string;
  type: "conversation" | "meeting" | "note" | "opportunity";
  label: string;
  createdAt: string;
}

export interface AgentNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface AgentDetail extends AgentListItem {
  daily: AgentDailyPoint[];
  weekly: AgentWeeklyPoint[];
  monthly: AgentMonthlyPoint[];
  activity: AgentActivityEvent[];
  notes: AgentNote[];
}

/** Reuses getAgentList's per-agent computation (not duplicated) and adds the
 * time-series/timeline/notes only the profile page needs. The "actividad
 * reciente" feed is assembled from existing timestamps across conversations/
 * bookings/notes/opportunities — not a real audit log (audit_log isn't
 * built yet, see docs/blueprint/02-database.md's deferred tables). */
export async function getAgentDetail(workspaceId: string, memberId: string): Promise<AgentDetail | null> {
  const supabase = await createClient();

  const list = await getAgentList(workspaceId, {});
  const base = list.find((a) => a.memberId === memberId);
  if (!base) return null;

  const [{ data: conversations }, { data: bookings }, { data: notes }, { data: opportunities }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, contact_id, created_at, contacts(name)")
      .eq("workspace_id", workspaceId)
      .eq("assigned_user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("bookings")
      .select("id, subject, start_time, status, contacts(name)")
      .eq("workspace_id", workspaceId)
      .eq("owner_id", memberId)
      .order("start_time", { ascending: false })
      .limit(20),
    supabase
      .from("notes")
      .select("id, body, created_at")
      .eq("workspace_id", workspaceId)
      .eq("notable_type", "workspace_member")
      .eq("notable_id", memberId)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunities")
      .select("id, title, status, created_at")
      .eq("workspace_id", workspaceId)
      .eq("owner_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const conversationIds = (conversations ?? []).map((c) => c.id as string);
  const { data: messages } = conversationIds.length
    ? await supabase
        .from("messages")
        .select("conversation_id, direction, created_at")
        .in("conversation_id", conversationIds)
        .eq("direction", "outbound")
    : { data: [] };

  const dailyBuckets = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const m of messages ?? []) {
    const key = (m.created_at as string).slice(0, 10);
    if (dailyBuckets.has(key)) dailyBuckets.set(key, (dailyBuckets.get(key) ?? 0) + 1);
  }
  const daily: AgentDailyPoint[] = Array.from(dailyBuckets.entries()).map(([key, count]) => ({
    label: new Date(key).toLocaleDateString("es", { day: "2-digit", month: "2-digit" }),
    messages: count,
  }));

  const weekly: AgentWeeklyPoint[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = getMonday(new Date());
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const count = (bookings ?? []).filter((b) => {
      const t = new Date(b.start_time as string);
      return t >= start && t < end && b.status !== "cancelled";
    }).length;
    weekly.push({ label: start.toLocaleDateString("es", { day: "2-digit", month: "2-digit" }), meetings: count });
  }

  const monthly: AgentMonthlyPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    d.setHours(0, 0, 0, 0);
    const monthEnd = new Date(d);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const count = (opportunities ?? []).filter((o) => {
      const t = new Date(o.created_at as string);
      return o.status === "won" && t >= d && t < monthEnd;
    }).length;
    monthly.push({ label: d.toLocaleDateString("es", { month: "short" }), won: count });
  }

  const activity: AgentActivityEvent[] = [
    ...(conversations ?? []).map((c) => {
      const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
      return {
        id: `conv-${c.id}`,
        type: "conversation" as const,
        label: `Lead asignado — ${contact?.name ?? "Sin nombre"}`,
        createdAt: c.created_at as string,
      };
    }),
    ...(bookings ?? []).map((b) => {
      const contact = Array.isArray(b.contacts) ? b.contacts[0] : b.contacts;
      return {
        id: `booking-${b.id}`,
        type: "meeting" as const,
        label: `Reunión ${b.status === "cancelled" ? "cancelada" : "agendada"} — ${b.subject ?? contact?.name ?? "Sin asunto"}`,
        createdAt: b.start_time as string,
      };
    }),
    ...(opportunities ?? []).map((o) => ({
      id: `opp-${o.id}`,
      type: "opportunity" as const,
      label: `Oportunidad ${o.status === "won" ? "ganada" : o.status === "lost" ? "perdida" : "creada"} — ${o.title}`,
      createdAt: o.created_at as string,
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20);

  return {
    ...base,
    daily,
    weekly,
    monthly,
    activity,
    notes: (notes ?? []).map((n) => ({ id: n.id as string, body: n.body as string, createdAt: n.created_at as string })),
  };
}
