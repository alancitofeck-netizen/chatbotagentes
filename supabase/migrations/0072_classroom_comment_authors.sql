-- Resolves display name/avatar for Classroom comment authors. Unlike every
-- other "who is this" lookup in the app, workspace_member_names(ws_id) can't
-- be reused here — Classroom's comments are global (0071_classroom_module.sql),
-- so a commenter may not even belong to the CURRENT viewer's workspace at
-- all. This is the same SECURITY DEFINER shape as workspace_member_names
-- (0003_inbox.sql/0049_user_avatars.sql), just keyed by an arbitrary list of
-- user ids instead of one workspace_id.

create or replace function public.classroom_user_names(user_ids uuid[])
returns table (user_id uuid, full_name text, avatar_url text)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id as user_id,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as full_name,
    u.raw_user_meta_data ->> 'avatar_url' as avatar_url
  from auth.users u
  where u.id = any(user_ids);
$$;

grant execute on function public.classroom_user_names(uuid[]) to authenticated;
