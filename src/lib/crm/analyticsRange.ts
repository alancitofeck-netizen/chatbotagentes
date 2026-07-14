import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DateRangePreset = "today" | "week" | "month" | "year" | "custom";

export interface DateRange {
  start: string;
  end: string;
}

/** Monday-start week, matching src/lib/agents/queries.ts's getMonday. */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function resolveDateRange(preset: DateRangePreset, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (preset === "custom") {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
    const customEndDate = customEnd ? new Date(`${customEnd}T23:59:59.999`) : end;
    return { start: start.toISOString(), end: customEndDate.toISOString() };
  }

  let start: Date;
  if (preset === "today") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "week") {
    start = mondayOf(now);
  } else if (preset === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface CrmAnalyticsRangeData {
  newContacts: number;
  conversations: number;
  meetingsScheduled: number;
  oppsWon: number;
  oppsLost: number;
  avgResponseMinutes: number | null;
  activeClients: number;
  leadsSeries: { date: string; count: number }[];
}

/** Date-boxed metrics for the Analytics tab's range filter — kept separate
 * from deriveCrmAnalytics (src/lib/crm/analytics.ts), which reads the
 * already-fetched CrmBoard and answers "current state of the funnel", a
 * question that isn't meaningfully date-scoped. This does its own targeted
 * queries instead, since the questions here ("how many X happened between
 * date A and B") span tables the board object doesn't carry (all contacts/
 * conversations/messages, not just ones tied to an open opportunity). */
export async function getCrmAnalyticsRangeData(workspaceId: string, range: DateRange): Promise<CrmAnalyticsRangeData> {
  const supabase = await createClient();

  const [
    { data: contacts },
    { data: conversations },
    { count: bookingsCount },
    { count: wonCount },
    { count: lostCount },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("conversations")
      .select("id, contact_id")
      .eq("workspace_id", workspaceId)
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .neq("status", "cancelled")
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    // "Won"/"lost" opportunities in the period — opportunities.status is kept
    // in sync with the destination stage's is_won/is_lost on every drag
    // (src/lib/crm/actions.ts::moveOpportunityCard), so filtering by status
    // directly is equivalent to re-deriving it from pipeline_stages here.
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "won")
      .gte("updated_at", range.start)
      .lte("updated_at", range.end),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "lost")
      .gte("updated_at", range.start)
      .lte("updated_at", range.end),
    supabase
      .from("messages")
      .select("conversation_id, direction, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", range.start)
      .lte("created_at", range.end)
      .order("created_at", { ascending: true }),
  ]);

  // Same inbound→next-outbound gap heuristic as getAgentList
  // (src/lib/agents/queries.ts), aggregated workspace-wide instead of per-agent.
  const messagesByConversation = new Map<string, { direction: string; createdAt: string }[]>();
  for (const m of messages ?? []) {
    const list = messagesByConversation.get(m.conversation_id as string) ?? [];
    list.push({ direction: m.direction as string, createdAt: m.created_at as string });
    messagesByConversation.set(m.conversation_id as string, list);
  }
  const responseGapsMin: number[] = [];
  const activeContactIds = new Set<string>();
  for (const [, msgs] of messagesByConversation) {
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].direction === "inbound" && i + 1 < msgs.length && msgs[i + 1].direction === "outbound") {
        const gapMin = (new Date(msgs[i + 1].createdAt).getTime() - new Date(msgs[i].createdAt).getTime()) / 60000;
        responseGapsMin.push(gapMin);
      }
    }
  }
  for (const c of conversations ?? []) {
    if (messagesByConversation.has(c.id as string)) activeContactIds.add(c.contact_id as string);
  }

  const avgResponseMinutes = responseGapsMin.length
    ? Math.round((responseGapsMin.reduce((s, v) => s + v, 0) / responseGapsMin.length) * 10) / 10
    : null;

  const countsByDay = new Map<string, number>();
  for (const c of contacts ?? []) {
    const day = (c.created_at as string).slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }
  const leadsSeries = Array.from(countsByDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    newContacts: (contacts ?? []).length,
    conversations: (conversations ?? []).length,
    meetingsScheduled: bookingsCount ?? 0,
    oppsWon: wonCount ?? 0,
    oppsLost: lostCount ?? 0,
    avgResponseMinutes,
    activeClients: activeContactIds.size,
    leadsSeries,
  };
}
