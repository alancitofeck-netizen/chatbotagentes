"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { touchLastActive } from "@/lib/presence/actions";
import { workspacePresenceChannelName, type PresenceStatus } from "@/lib/presence/channel";

const PERSIST_INTERVAL_MS = 60_000;
const PRESENCE_TICK_MS = 20_000;
const AWAY_AFTER_MS = 5 * 60_000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;

/** Mounted once in (protected)/layout.tsx — tracks the current member as
 * "online"/"away" on a per-workspace Supabase Realtime Presence channel
 * (ephemeral, no table involved) and periodically persists last_active_at
 * (0039/0040 migrations) as the fallback shown once nobody is connected.
 * Not mounted while isSupervising (ReminderWatcher/layout.tsx) — a platform
 * admin viewing someone else's workspace isn't "present" there. */
export function PresenceHeartbeat({ workspaceId, memberId }: { workspaceId: string; memberId: string | null }) {
  useEffect(() => {
    if (!memberId) return;
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let lastActivityAt = Date.now();

    const markActivity = () => {
      lastActivityAt = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));

    function currentStatus(): PresenceStatus {
      return Date.now() - lastActivityAt > AWAY_AFTER_MS ? "away" : "online";
    }

    async function track() {
      if (!channel) return;
      await channel.track({ member_id: memberId, status: currentStatus(), online_at: new Date().toISOString() });
    }

    // Same session-hydration race documented in InboxShell.tsx/
    // ContactsShell.tsx — subscribing before the JWT is attached would join
    // anonymously (harmless here since this channel isn't marked private,
    // but setAuth is kept for consistency with the rest of the app).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase.channel(workspacePresenceChannelName(workspaceId), {
        config: { presence: { key: memberId! } },
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") track();
      });
    });

    const presenceTick = setInterval(track, PRESENCE_TICK_MS);
    const persistTick = setInterval(touchLastActive, PERSIST_INTERVAL_MS);
    touchLastActive();

    return () => {
      cancelled = true;
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity));
      clearInterval(presenceTick);
      clearInterval(persistTick);
      if (channel) supabase.removeChannel(channel);
    };
  }, [workspaceId, memberId]);

  return null;
}
