import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { ALL_CATEGORIES, type NotificationCategory } from "@/lib/notifications/catalog";

export interface NotificationRow {
  id: string;
  category: NotificationCategory;
  eventType: string;
  priority: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

const PAGE_SIZE = 30;

function mapRow(row: Record<string, unknown>): NotificationRow {
  return {
    id: row.id as string,
    category: row.category as NotificationCategory,
    eventType: row.event_type as string,
    priority: row.priority as NotificationRow["priority"],
    title: row.title as string,
    message: row.message as string,
    actionUrl: (row.action_url as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    read: row.read as boolean,
    createdAt: row.created_at as string,
  };
}

/** Own notifications only — RLS (notifications_select_own) already enforces
 * this, the explicit `.eq("member_id", ...)` here is just to avoid pulling
 * every workspace's worth of rows through the round trip before RLS filters
 * them, same "narrow the query, don't rely on RLS alone for performance"
 * habit as the rest of the app's list queries. */
export async function getNotifications(filter?: { unreadOnly?: boolean; category?: NotificationCategory }) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return [];

  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("id, category, event_type, priority, title, message, action_url, metadata, read, created_at")
    .eq("workspace_id", workspaceId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (filter?.unreadOnly) query = query.eq("read", false);
  if (filter?.category) query = query.eq("category", filter.category);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapRow);
}

export interface NotificationPreference {
  enabled: boolean;
  email: boolean;
  push: boolean;
}

const DEFAULT_PREFERENCE: NotificationPreference = { enabled: true, email: false, push: false };

/** Ausencia de fila = default (ver 0081_notification_preferences.sql) — esta
 * función siempre devuelve las 7 categorías, rellenando con el default
 * cualquiera que el miembro nunca haya tocado, así el llamador (la card de
 * Preferencias) no tiene que manejar "categoría sin fila" como caso aparte. */
export async function getNotificationPreferences(): Promise<Record<NotificationCategory, NotificationPreference>> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const result = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, DEFAULT_PREFERENCE])) as Record<
    NotificationCategory,
    NotificationPreference
  >;
  if (!memberId) return result;

  const supabase = await createClient();
  const { data } = await supabase.from("notification_preferences").select("category, enabled, email, push").eq("member_id", memberId);
  for (const row of data ?? []) {
    result[row.category as NotificationCategory] = { enabled: row.enabled as boolean, email: row.email as boolean, push: row.push as boolean };
  }
  return result;
}

export async function getUnreadCount(): Promise<number> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("member_id", memberId)
    .eq("read", false);
  return count ?? 0;
}
