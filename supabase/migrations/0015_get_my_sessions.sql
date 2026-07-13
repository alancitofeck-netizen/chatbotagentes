-- Exposes auth.sessions (already maintained by Supabase Auth on every
-- login/token refresh — created_at/updated_at/user_agent/ip, no custom
-- login-event tracking needed) for the new Perfil > Seguridad "Sesiones
-- activas" section. PostgREST doesn't expose the `auth` schema, so a
-- SECURITY DEFINER wrapper is required, same pattern as
-- public.workspace_member_names (0003_inbox.sql). Filters by auth.uid()
-- internally — a user can never see another user's sessions regardless of
-- what's passed in (there's nothing to pass in; it takes no arguments).
create or replace function public.get_my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, s.ip::text
  from auth.sessions s
  where s.user_id = auth.uid()
  order by s.updated_at desc nulls last;
$$;

revoke all on function public.get_my_sessions() from public;
revoke all on function public.get_my_sessions() from anon;
grant execute on function public.get_my_sessions() to authenticated;
