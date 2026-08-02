"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  markReadAction,
  markAllReadAction,
  deleteNotificationAction,
  deleteAllNotificationsAction,
  type NotificationRow,
  type NotificationPreference,
} from "@/lib/notifications/actions";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { showBrowserNotification } from "@/lib/notifications/browserPush";
import type { NotificationCategory } from "@/lib/notifications/catalog";

const MAX_LIST = 30;

/** Replaces the decorative bell that used to live inline in Navbar.tsx
 * ("Notificaciones — próximamente") — now a real, workspace-scoped
 * notification center. Realtime subscription mirrors the naming/positioning
 * convention already used by presence (src/lib/presence/channel.ts +
 * useWorkspacePresence.ts): one channel per member, postgres_changes INSERT
 * instead of the presence protocol since this is row data, not ephemeral
 * state. */
export function NotificationBell({
  memberId,
  initialNotifications,
  initialUnreadCount,
  initialPreferences,
}: {
  memberId: string;
  initialNotifications: NotificationRow[];
  initialUnreadCount: number;
  /** Snapshot at page load — a preference changed in another tab won't
   * retroactively affect an already-mounted bell until the next full
   * navigation, same limitation the rest of this app accepts for
   * server-fetched initial state (e.g. enabledModules in ProtectedLayout). */
  initialPreferences: Record<NotificationCategory, NotificationPreference> | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Ref (not a dependency) so the realtime effect below doesn't need to
  // resubscribe just because the parent re-rendered with a new object
  // reference for the same underlying preferences. Synced in its own effect
  // — mutating a ref during render itself isn't allowed.
  const preferencesRef = useRef(initialPreferences);
  useEffect(() => {
    preferencesRef.current = initialPreferences;
  }, [initialPreferences]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase.channel(`notifications:member:${memberId}`);
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `member_id=eq.${memberId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const next: NotificationRow = {
            id: row.id as string,
            category: row.category as NotificationRow["category"],
            eventType: row.event_type as string,
            priority: row.priority as NotificationRow["priority"],
            title: row.title as string,
            message: row.message as string,
            actionUrl: (row.action_url as string | null) ?? null,
            metadata: (row.metadata as Record<string, unknown>) ?? {},
            read: false,
            createdAt: row.created_at as string,
          };
          setNotifications((prev) => [next, ...prev].slice(0, MAX_LIST));
          setUnreadCount((prev) => prev + 1);

          if (preferencesRef.current?.[next.category]?.push) {
            showBrowserNotification(next.title, next.message, next.actionUrl);
          }
        },
      );
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [memberId]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    markReadAction(id);
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    markAllReadAction();
  }

  function handleDelete(id: string) {
    const wasUnread = notifications.find((n) => n.id === id)?.read === false;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    deleteNotificationAction(id);
  }

  function handleDeleteAll() {
    setNotifications([]);
    setUnreadCount(0);
    deleteAllNotificationsAction();
  }

  function handleNavigate(n: NotificationRow) {
    setOpen(false);
    if (n.actionUrl) router.push(n.actionUrl);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        title="Notificaciones"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-foreground"
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex min-w-[16px] items-center justify-center rounded-full bg-error-strong px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel
          triggerRef={triggerRef}
          panelRef={panelRef}
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onDelete={handleDelete}
          onDeleteAll={handleDeleteAll}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
