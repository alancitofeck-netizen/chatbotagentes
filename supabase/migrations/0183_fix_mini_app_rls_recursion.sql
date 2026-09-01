-- FIX URGENTE: las policies de mini_apps/mini_app_access agregadas en
-- 0180_mini_app_privacy.sql se referencian mutuamente dentro de sus propios
-- USING (mini_apps_select consulta mini_app_access, mini_app_access_select
-- consulta mini_apps) — Postgres detecta esto como recursión infinita
-- (error 42P17 "infinite recursion detected in policy for relation
-- mini_apps") y termina bloqueando el acceso a TODAS las Mini Apps para
-- TODO el mundo (confirmado con una sesión real: 0 filas visibles pese a
-- is_private=false). Mismo bug también heredado por las 4 tablas de
-- mini_app_content_* (sus policies atraviesan mini_apps/mini_app_access).
--
-- Fix: exactamente el mismo patrón que ya usa el proyecto desde el día uno
-- para evitar esto — core.is_workspace_member/has_workspace_role
-- (0001_workspaces_and_members.sql) son SECURITY DEFINER, así que sus
-- queries internas NO vuelven a disparar el RLS de la tabla que consultan.
-- Acá se agregan 3 funciones nuevas con el mismo criterio, y las policies
-- pasan a llamarlas en vez de hacer subqueries directos contra la otra
-- tabla protegida por RLS — mismo resultado final, sin el loop.

create or replace function core.mini_app_workspace_id(p_mini_app_id uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select workspace_id from public.mini_apps where id = p_mini_app_id
$$;

create or replace function core.mini_app_id_for_content_day(p_day_id uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select mini_app_id from public.mini_app_content_days where id = p_day_id
$$;

create or replace function core.can_view_mini_app(p_mini_app_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.mini_apps a
    where a.id = p_mini_app_id
      and core.is_workspace_member(a.workspace_id)
      and (
        not a.is_private
        or core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
        or exists (
          select 1 from public.mini_app_access ma
          join public.workspace_members m on m.id = ma.member_id
          where ma.mini_app_id = a.id and m.user_id = auth.uid()
        )
      )
  )
$$;

create or replace function core.can_edit_mini_app(p_mini_app_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.mini_apps a
    where a.id = p_mini_app_id
      and (
        core.has_workspace_role(a.workspace_id, array['owner', 'admin'])
        or exists (
          select 1 from public.mini_app_access ma
          join public.workspace_members m on m.id = ma.member_id
          where ma.mini_app_id = a.id and m.user_id = auth.uid() and ma.role = 'editor'
        )
      )
  )
$$;

drop policy if exists "mini_apps_select" on public.mini_apps;
create policy "mini_apps_select" on public.mini_apps
  for select using (core.can_view_mini_app(id));

drop policy if exists "mini_app_access_select" on public.mini_app_access;
create policy "mini_app_access_select" on public.mini_app_access
  for select using (core.is_workspace_member(core.mini_app_workspace_id(mini_app_id)));

drop policy if exists "mini_app_access_write" on public.mini_app_access;
create policy "mini_app_access_write" on public.mini_app_access
  for all
  using (core.has_workspace_role(core.mini_app_workspace_id(mini_app_id), array['owner', 'admin']))
  with check (core.has_workspace_role(core.mini_app_workspace_id(mini_app_id), array['owner', 'admin']));

drop policy if exists "mini_app_content_days_select" on public.mini_app_content_days;
create policy "mini_app_content_days_select" on public.mini_app_content_days
  for select using (core.can_view_mini_app(mini_app_id));
drop policy if exists "mini_app_content_days_write" on public.mini_app_content_days;
create policy "mini_app_content_days_write" on public.mini_app_content_days
  for all using (core.can_edit_mini_app(mini_app_id));

drop policy if exists "mini_app_content_pieces_select" on public.mini_app_content_pieces;
create policy "mini_app_content_pieces_select" on public.mini_app_content_pieces
  for select using (core.can_view_mini_app(core.mini_app_id_for_content_day(day_id)));
drop policy if exists "mini_app_content_pieces_write" on public.mini_app_content_pieces;
create policy "mini_app_content_pieces_write" on public.mini_app_content_pieces
  for all using (core.can_edit_mini_app(core.mini_app_id_for_content_day(day_id)));

drop policy if exists "mini_app_content_stories_select" on public.mini_app_content_stories;
create policy "mini_app_content_stories_select" on public.mini_app_content_stories
  for select using (core.can_view_mini_app(core.mini_app_id_for_content_day(day_id)));
drop policy if exists "mini_app_content_stories_write" on public.mini_app_content_stories;
create policy "mini_app_content_stories_write" on public.mini_app_content_stories
  for all using (core.can_edit_mini_app(core.mini_app_id_for_content_day(day_id)));

drop policy if exists "mini_app_content_references_select" on public.mini_app_content_references;
create policy "mini_app_content_references_select" on public.mini_app_content_references
  for select using (core.can_view_mini_app(mini_app_id));
drop policy if exists "mini_app_content_references_write" on public.mini_app_content_references;
create policy "mini_app_content_references_write" on public.mini_app_content_references
  for all using (core.can_edit_mini_app(mini_app_id));
