import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PlatformWorkspaceSummary {
  workspaceId: string;
  name: string;
  slug: string;
  createdAt: string;
  status: string;
  plan: string;
  primaryUserName: string;
  primaryUserEmail: string;
  memberCount: number;
  lastActivityAt: string | null;
  connectedIntegrations: string[];
  hasWhatsApp: boolean;
  hasGoogleCalendar: boolean;
  hasGoogleSheets: boolean;
  hasGoogleDrive: boolean;
  hasAi: boolean;
  botActive: boolean;
  leadsCount: number;
  openConversationsCount: number;
  conversationTrend: number[];
  opportunitiesCount: number;
  todayBookingsCount: number;
}

const INTEGRATION_LABELS: Record<string, string> = {
  ycloud: "WhatsApp",
  openrouter: "OpenRouter",
  highlevel: "HighLevel",
  google_calendar: "Google Calendar",
  google_sheets: "Google Sheets",
  google_drive: "Google Drive",
  calendly: "Calendly",
};

const TREND_DAYS = 7;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

/** Owner global's cross-workspace list — reuses the CRM "Agentes" tab
 * (src/app/(protected)/crm/CrmPageShell.tsx renders this instead of the
 * normal per-workspace AgentsList when the viewer is a platform admin, per
 * the corrected architecture: no separate admin module). Every read here
 * uses the PLAIN client, not the service role — 0039_role_permissions_system.sql
 * extends core.is_workspace_member() so a platform admin's session passes
 * RLS for every row across every one of these tables, no per-workspace
 * filter needed anywhere. The service role is only used afterwards, to
 * resolve each workspace's "usuario principal" display name/email from
 * auth.users (no cross-workspace "names" RPC exists for that). */
export async function getAllWorkspacesForSupervision(): Promise<PlatformWorkspaceSummary[]> {
  const supabase = await createClient();

  const trendStart = new Date();
  trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));
  trendStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const [
    { data: workspaces },
    { data: members },
    { data: integrations },
    { data: contacts },
    { data: conversations },
    { data: recentConversations },
    { data: opportunities },
    { data: todayBookings },
    { data: aiAgents },
  ] = await Promise.all([
    supabase.from("workspaces").select("id, name, slug, created_at, status, plan").order("created_at", { ascending: false }),
    supabase.from("workspace_members").select("workspace_id, user_id, created_at, last_active_at").order("created_at", { ascending: true }),
    supabase.from("integration_connections").select("workspace_id, provider").eq("status", "active"),
    supabase.from("contacts").select("workspace_id"),
    supabase.from("conversations").select("workspace_id, status").neq("status", "closed"),
    supabase.from("conversations").select("workspace_id, created_at").gte("created_at", trendStart.toISOString()),
    supabase.from("opportunities").select("workspace_id"),
    supabase
      .from("bookings")
      .select("workspace_id")
      .neq("status", "cancelled")
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", todayEnd.toISOString()),
    supabase.from("ai_agents").select("workspace_id, status"),
  ]);
  if (!workspaces) return [];

  const membersByWorkspace = new Map<string, { user_id: string; created_at: string; last_active_at: string | null }[]>();
  for (const m of members ?? []) {
    const list = membersByWorkspace.get(m.workspace_id as string) ?? [];
    list.push({
      user_id: m.user_id as string,
      created_at: m.created_at as string,
      last_active_at: m.last_active_at as string | null,
    });
    membersByWorkspace.set(m.workspace_id as string, list);
  }

  // Rows are already ordered by created_at ascending, so index 0 per
  // workspace is "the earliest member" — the workspace's own registrant,
  // regardless of their current role (a solo self-service signup is now
  // always role "agent", never "owner" — see provision-workspace.ts).
  const primaryUserIds = new Set<string>();
  for (const list of membersByWorkspace.values()) {
    if (list[0]) primaryUserIds.add(list[0].user_id);
  }

  const serviceClient = createServiceRoleClient();
  const userInfoById = new Map<string, { name: string; email: string }>();
  await Promise.all(
    [...primaryUserIds].map(async (userId) => {
      const { data } = await serviceClient.auth.admin.getUserById(userId);
      if (data?.user) {
        userInfoById.set(userId, {
          name: (data.user.user_metadata?.full_name as string | undefined) || data.user.email || "—",
          email: data.user.email ?? "—",
        });
      }
    }),
  );

  const integrationsByWorkspace = new Map<string, Set<string>>();
  for (const row of integrations ?? []) {
    const set = integrationsByWorkspace.get(row.workspace_id as string) ?? new Set<string>();
    set.add(row.provider as string);
    integrationsByWorkspace.set(row.workspace_id as string, set);
  }

  const leadsByWorkspace = new Map<string, number>();
  for (const row of contacts ?? []) {
    const key = row.workspace_id as string;
    leadsByWorkspace.set(key, (leadsByWorkspace.get(key) ?? 0) + 1);
  }

  const openConversationsByWorkspace = new Map<string, number>();
  for (const row of conversations ?? []) {
    const key = row.workspace_id as string;
    openConversationsByWorkspace.set(key, (openConversationsByWorkspace.get(key) ?? 0) + 1);
  }

  const trendBucketsByWorkspace = new Map<string, Map<string, number>>();
  for (const row of recentConversations ?? []) {
    const key = row.workspace_id as string;
    const buckets = trendBucketsByWorkspace.get(key) ?? new Map<string, number>();
    const day = dayKey(row.created_at as string);
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
    trendBucketsByWorkspace.set(key, buckets);
  }
  const trendDayKeys: string[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    trendDayKeys.push(d.toISOString().slice(0, 10));
  }

  const opportunitiesByWorkspace = new Map<string, number>();
  for (const row of opportunities ?? []) {
    const key = row.workspace_id as string;
    opportunitiesByWorkspace.set(key, (opportunitiesByWorkspace.get(key) ?? 0) + 1);
  }

  const todayBookingsByWorkspace = new Map<string, number>();
  for (const row of todayBookings ?? []) {
    const key = row.workspace_id as string;
    todayBookingsByWorkspace.set(key, (todayBookingsByWorkspace.get(key) ?? 0) + 1);
  }

  const botActiveByWorkspace = new Set<string>();
  for (const row of aiAgents ?? []) {
    if (row.status === "active") botActiveByWorkspace.add(row.workspace_id as string);
  }

  return workspaces.map((w) => {
    const workspaceId = w.id as string;
    const list = membersByWorkspace.get(workspaceId) ?? [];
    const primaryUser = list[0] ? userInfoById.get(list[0].user_id) : undefined;
    const providers = integrationsByWorkspace.get(workspaceId);
    const trendBuckets = trendBucketsByWorkspace.get(workspaceId);

    const lastActivityAt = list.reduce<string | null>((latest, m) => {
      if (!m.last_active_at) return latest;
      if (!latest || m.last_active_at > latest) return m.last_active_at;
      return latest;
    }, null);

    return {
      workspaceId,
      name: w.name as string,
      slug: w.slug as string,
      createdAt: w.created_at as string,
      status: w.status as string,
      plan: w.plan as string,
      primaryUserName: primaryUser?.name ?? "—",
      primaryUserEmail: primaryUser?.email ?? "—",
      memberCount: list.length,
      lastActivityAt,
      connectedIntegrations: providers ? [...providers].map((p) => INTEGRATION_LABELS[p] ?? p) : [],
      hasWhatsApp: providers?.has("ycloud") ?? false,
      hasGoogleCalendar: providers?.has("google_calendar") ?? false,
      hasGoogleSheets: providers?.has("google_sheets") ?? false,
      hasGoogleDrive: providers?.has("google_drive") ?? false,
      hasAi: providers?.has("openrouter") ?? false,
      botActive: botActiveByWorkspace.has(workspaceId),
      leadsCount: leadsByWorkspace.get(workspaceId) ?? 0,
      openConversationsCount: openConversationsByWorkspace.get(workspaceId) ?? 0,
      conversationTrend: trendDayKeys.map((day) => trendBuckets?.get(day) ?? 0),
      opportunitiesCount: opportunitiesByWorkspace.get(workspaceId) ?? 0,
      todayBookingsCount: todayBookingsByWorkspace.get(workspaceId) ?? 0,
    };
  });
}
