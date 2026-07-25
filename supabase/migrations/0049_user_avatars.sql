-- Profile photos: one photo per user (not per workspace_member), stored in
-- auth.users.user_metadata.avatar_url — same place full_name/username/phone
-- already live (see updateMyProfile, src/lib/profile/actions.ts), so a
-- single upload is automatically visible in every workspace the user
-- belongs to, matching "una única foto por usuario" (confirmed with the
-- user). No new table needed.
--
-- Storage: a new public bucket (unlike `documents`, which is private and
-- workspace-scoped) — avatars are low-sensitivity, and every place they're
-- rendered (Sidebar, Inbox, CRM Agentes, Calendar, the cross-workspace
-- Platform admin table, etc.) uses a plain <img src> with no signed-URL
-- plumbing, so a public URL keeps every one of those call sites simple.
-- Path convention: {user_id}/avatar.<ext> — fixed filename, upsert on
-- re-upload, so there is always exactly one object per user (old one is
-- overwritten, not accumulated).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Even though the bucket is public (reads via the public URL bypass RLS
-- entirely), storage.objects still needs its own SELECT policy: the
-- Storage API's upload endpoint issues its INSERT with a RETURNING clause,
-- and Postgres RLS requires a matching SELECT policy to satisfy that
-- clause's row-visibility check — without it, every upload/upsert fails
-- with "new row violates row-level security policy", even though the
-- INSERT policy's own WITH CHECK independently evaluates true. Confirmed by
-- reproducing the exact same failure via raw SQL (RETURNING) vs success
-- (no RETURNING) with an otherwise-identical INSERT.
create policy "avatars_storage_select" on storage.objects
  for select using (bucket_id = 'avatars');

-- Only the user themselves may write/replace/delete their own avatar —
-- enforced by the first path segment matching their own auth.uid().
create policy "avatars_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_storage_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Extend workspace_member_names (0003_inbox.sql) with avatar_url — this one
-- SECURITY DEFINER function already backs every "resolve display name for a
-- workspace member" lookup across the app (agents/inbox/calendar/crm/
-- advisors/tasks/dashboard/documents/settings queries), so adding avatar_url
-- here propagates a user's photo everywhere their name already shows,
-- without a second RPC. Return columns changed, so this must be dropped and
-- recreated (CREATE OR REPLACE can't alter a function's OUT columns).
drop function if exists public.workspace_member_names(uuid);

create function public.workspace_member_names(ws_id uuid)
returns table (member_id uuid, user_id uuid, full_name text, email text, avatar_url text)
language sql
security definer
set search_path = ''
stable
as $$
  select
    m.id as member_id,
    m.user_id,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as full_name,
    u.email,
    u.raw_user_meta_data ->> 'avatar_url' as avatar_url
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws_id
    and core.is_workspace_member(ws_id);
$$;

grant execute on function public.workspace_member_names(uuid) to authenticated;
