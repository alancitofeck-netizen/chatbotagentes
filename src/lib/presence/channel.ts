/** Shared channel name so PresenceHeartbeat (tracks the current user) and
 * useWorkspacePresence (reads everyone's status) subscribe to the exact same
 * Supabase Realtime Presence topic for a given workspace. */
export function workspacePresenceChannelName(workspaceId: string) {
  return `presence:workspace:${workspaceId}`;
}

export type PresenceStatus = "online" | "away";

export interface PresencePayload {
  member_id: string;
  status: PresenceStatus;
  online_at: string;
}
