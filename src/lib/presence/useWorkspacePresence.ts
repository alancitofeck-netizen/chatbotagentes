"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { workspacePresenceChannelName, type PresencePayload, type PresenceStatus } from "./channel";

/** Read-only counterpart to PresenceHeartbeat.tsx — subscribes to the same
 * per-workspace Presence channel and returns a live memberId -> status map
 * for the "Estado" column in AgentsList/the platform supervision panel.
 * Members with no active session simply don't appear in the map (rendered
 * as "offline" by the caller, falling back to last_active_at). */
export function useWorkspacePresence(workspaceId: string | null): Partial<Record<string, PresenceStatus>> {
  const [state, setState] = useState<Partial<Record<string, PresenceStatus>>>({});

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase.channel(workspacePresenceChannelName(workspaceId));
      channel.on("presence", { event: "sync" }, () => {
        if (!channel) return;
        const presenceState = channel.presenceState<PresencePayload>();
        const next: Partial<Record<string, PresenceStatus>> = {};
        for (const presences of Object.values(presenceState)) {
          const latest = presences[presences.length - 1];
          if (latest) next[latest.member_id] = latest.status;
        }
        setState(next);
      });
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return state;
}
