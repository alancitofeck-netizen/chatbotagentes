"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { workspacePresenceChannelName } from "./channel";

const POLL_MS = 4000;

/** Owner global's cross-workspace "usuarios activos" column
 * (PlatformWorkspacesTable.tsx) — reads live online counts for every listed
 * workspace's Presence channel at once (same channel PresenceHeartbeat.tsx
 * tracks into for that workspace's own members).
 *
 * Deliberately polls `channel.presenceState()` on an interval instead of
 * attaching a `.on("presence", {event:"sync"})` listener like
 * useWorkspacePresence.ts does — `createClient()` (@supabase/ssr) returns a
 * cached singleton, so when the platform admin is viewing THEIR OWN
 * workspace here, `supabase.channel(topic)` returns the exact same
 * already-`subscribe()`d channel object PresenceHeartbeat is using for that
 * workspace. Supabase-js throws ("cannot add `presence` callbacks... after
 * `subscribe()`") if you try to attach a new listener to an already-joined
 * channel — confirmed live. Polling the already-live presence state instead
 * needs no new listener, so it works whether this hook subscribed the
 * channel itself or is just reading one someone else already joined. */
export function useMultiWorkspacePresence(workspaceIds: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = workspaceIds.join(",");

  useEffect(() => {
    if (workspaceIds.length === 0) return;
    const supabase = createClient();
    let cancelled = false;
    const ownedChannels: ReturnType<typeof supabase.channel>[] = [];
    let interval: ReturnType<typeof setInterval> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);

      const entries = workspaceIds.map((workspaceId) => {
        const topic = workspacePresenceChannelName(workspaceId);
        const existing = supabase.getChannels().find((c) => c.topic.endsWith(topic));
        if (existing) return { workspaceId, channel: existing };
        const channel = supabase.channel(topic);
        channel.subscribe();
        ownedChannels.push(channel);
        return { workspaceId, channel };
      });

      const readCounts = () => {
        setCounts(
          Object.fromEntries(entries.map(({ workspaceId, channel }) => [workspaceId, Object.keys(channel.presenceState()).length])),
        );
      };
      readCounts();
      interval = setInterval(readCounts, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      ownedChannels.forEach((channel) => supabase.removeChannel(channel));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return counts;
}
