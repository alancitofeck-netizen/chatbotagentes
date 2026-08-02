"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import {
  getNotifications,
  getUnreadCount,
  getNotificationPreferences,
  type NotificationRow,
  type NotificationPreference,
} from "@/lib/notifications/queries";
import type { NotificationCategory } from "@/lib/notifications/catalog";

export async function getNotificationsAction(filter?: { unreadOnly?: boolean; category?: NotificationCategory }) {
  return getNotifications(filter);
}

export async function getUnreadCountAction() {
  return getUnreadCount();
}

/** All four mutations below go through the caller's own RLS-scoped client
 * (not service-role) — notifications_update_own/delete_own already restrict
 * these to the caller's own member_id, so there's nothing a service-role
 * bypass would add here, same reasoning as conversation_reads' own-row
 * policies (0014). */
export async function markReadAction(notificationId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("member_id", memberId);
}

export async function markAllReadAction(): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("member_id", memberId)
    .eq("read", false);
}

export async function deleteNotificationAction(notificationId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("id", notificationId).eq("member_id", memberId);
}

export async function deleteAllNotificationsAction(): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("workspace_id", workspaceId).eq("member_id", memberId);
}

export async function getNotificationPreferencesAction() {
  return getNotificationPreferences();
}

/** Upsert on (member_id, category) — the request-scoped client (not
 * service-role) is correct here, unlike notify()'s writes: the caller IS the
 * member whose row this is, and notification_preferences_insert_own/
 * update_own (0081) already restrict it to exactly that row. */
export async function updateNotificationPreferenceAction(category: NotificationCategory, patch: Partial<NotificationPreference>): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  await supabase
    .from("notification_preferences")
    .upsert(
      { workspace_id: workspaceId, member_id: memberId, category, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "member_id,category" },
    );
}

export type { NotificationRow, NotificationPreference };
