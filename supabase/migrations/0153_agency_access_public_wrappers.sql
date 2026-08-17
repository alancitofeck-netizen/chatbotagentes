-- 0152 creó core.agency_workspace_id()/core.current_user_agency_role() pero
-- se llaman desde el navegador vía supabase.rpc(...), que pasa por PostgREST
-- — y PostgREST solo expone el schema `public` por default, no `core`. Sin
-- wrapper en `public`, el RPC fallaba en silencio (data null) para TODOS los
-- usuarios, incluido el propio owner, y el gate caía siempre a "sin acceso".
-- Mismo patrón que public.workspace_has_platform_admin_member (0143).
create or replace function public.agency_workspace_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select core.agency_workspace_id()
$$;

create or replace function public.current_user_agency_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select core.current_user_agency_role()
$$;

revoke all on function public.agency_workspace_id() from public;
grant execute on function public.agency_workspace_id() to authenticated;

revoke all on function public.current_user_agency_role() from public;
grant execute on function public.current_user_agency_role() to authenticated;
