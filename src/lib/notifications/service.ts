import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { EVENT_CATALOG, type NotificationEventType, type NotificationCategory } from "@/lib/notifications/catalog";
import { sendNotificationEmail } from "@/lib/email/resend";

interface NotifyInput {
  workspaceId: string;
  memberId: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Own-row default mirrors notification_preferences' column defaults
 * (0081_notification_preferences.sql) — a member who never touched
 * Preferencias has no row at all, which means "todo activado, sin email". */
async function getPreference(supabase: ReturnType<typeof createServiceRoleClient>, memberId: string, category: NotificationCategory) {
  const { data } = await supabase
    .from("notification_preferences")
    .select("enabled, email")
    .eq("member_id", memberId)
    .eq("category", category)
    .maybeSingle();
  return { enabled: (data?.enabled as boolean | undefined) ?? true, email: (data?.email as boolean | undefined) ?? false };
}

async function getMemberEmail(supabase: ReturnType<typeof createServiceRoleClient>, memberId: string): Promise<string | null> {
  const { data: member } = await supabase.from("workspace_members").select("user_id").eq("id", memberId).maybeSingle();
  if (!member?.user_id) return null;
  const { data } = await supabase.auth.admin.getUserById(member.user_id as string);
  return data.user?.email ?? null;
}

/** Centralized notification writer — every module calls this (or
 * notifyMany) instead of inserting into `notifications` directly, so a
 * future module only needs a new entry in catalog.ts + a call here, no new
 * plumbing. Always goes through the service-role client (never the caller's
 * own RLS-scoped session) because the recipient is frequently someone other
 * than the person whose action triggered the event — same reasoning as
 * src/lib/messaging/ingest.ts writing on behalf of a contact. Errors are
 * swallowed (logged only): a failed notification insert must never fail the
 * business action that triggered it (same posture as ReminderWatcher's
 * silent catch).
 *
 * Fase 3: checks notification_preferences before doing anything — a
 * category the member disabled skips both the in-app row AND email
 * entirely, not just email (see plan: "activar o desactivar por
 * categoría" is a full switch, "elegir el medio" is a second, independent
 * choice on top of that). Email send failures never block the in-app
 * notification, which is why it's fired after the insert, not before. */
export async function notify({ workspaceId, memberId, eventType, title, message, actionUrl, metadata }: NotifyInput) {
  const meta = EVENT_CATALOG[eventType];
  const supabase = createServiceRoleClient();

  const preference = await getPreference(supabase, memberId, meta.category);
  if (!preference.enabled) return;

  const { error } = await supabase.from("notifications").insert({
    workspace_id: workspaceId,
    member_id: memberId,
    category: meta.category,
    event_type: eventType,
    priority: meta.priority,
    title,
    message,
    action_url: actionUrl ?? null,
    metadata: metadata ?? {},
  });
  if (error) {
    console.error(`[notifications] notify(${eventType}) failed:`, error.message);
    return;
  }

  if (preference.email) {
    const email = await getMemberEmail(supabase, memberId);
    if (email) {
      const result = await sendNotificationEmail({ to: email, title, message, actionUrl: actionUrl ?? null });
      if (!result.ok) console.error(`[notifications] email send failed for ${eventType}:`, result.error);
    }
  }
}

export async function notifyMany(memberIds: string[], input: Omit<NotifyInput, "memberId">) {
  const unique = Array.from(new Set(memberIds));
  await Promise.all(unique.map((memberId) => notify({ ...input, memberId })));
}

/** For workspace-wide events with no single natural recipient (a new AI
 * agent, an execution error, a quota threshold, a disconnected integration)
 * — owners/admins are the closest thing this app has to "whoever manages
 * this workspace" (same reasoning as src/lib/settings/actions.ts's
 * getManagerMemberIds, duplicated here in its service-role form so callers
 * outside settings/actions.ts don't need to thread a request-scoped
 * Supabase client through just for this one read). */
export async function notifyManagers(workspaceId: string, input: Omit<NotifyInput, "memberId" | "workspaceId">, excludeMemberId?: string | null) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("workspace_members").select("id").eq("workspace_id", workspaceId).in("role", ["owner", "admin"]);
  const recipients = ((data ?? []) as { id: string }[]).map((m) => m.id).filter((id) => id !== excludeMemberId);
  await notifyMany(recipients, { ...input, workspaceId });
}
