-- Lets a member persist their own "last seen" timestamp — needed by the
-- real-time presence heartbeat (src/components/presence/PresenceHeartbeat.tsx)
-- as the fallback shown when nobody is currently connected to the Supabase
-- Realtime Presence channel. workspace_members' only UPDATE policy
-- (workspace_members_update_owner_admin, 0001_workspaces_and_members.sql) is
-- owner/admin-only, so a plain client update from an agent's own session
-- would be silently dropped by RLS — this SECURITY DEFINER RPC scopes the
-- write to exactly the caller's own row instead of loosening that policy.
create or replace function public.touch_last_active(ws_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workspace_members
  set last_active_at = now()
  where workspace_id = ws_id and user_id = auth.uid()
$$;
