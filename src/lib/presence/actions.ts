"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth/session";

/** Persists "last seen" for the current member — called periodically by
 * PresenceHeartbeat as the fallback shown when nobody is currently connected
 * to the live Presence channel. Uses public.touch_last_active (0040), a
 * SECURITY DEFINER RPC, since the plain workspace_members UPDATE policy is
 * owner/admin-only (0001_workspaces_and_members.sql). */
export async function touchLastActive() {
  const { workspaceId, isSupervising } = await requireActiveWorkspace();
  // A platform admin supervising someone else's workspace has no real
  // membership row there — nothing to touch, and it isn't their activity.
  if (isSupervising) return;

  const supabase = await createClient();
  await supabase.rpc("touch_last_active", { ws_id: workspaceId });
}
