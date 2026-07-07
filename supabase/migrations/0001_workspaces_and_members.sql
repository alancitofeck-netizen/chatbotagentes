-- Workspaces + membership — core multi-tenancy tables.
-- Spec: docs/blueprint/02-database.md, docs/blueprint/09-security.md
-- Apply with the Supabase CLI (`supabase db push`) or the Supabase MCP
-- `apply_migration` tool once a project is connected — see CLAUDE.md.

create schema if not exists core;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'agent', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists workspace_members_workspace_id_idx on public.workspace_members (workspace_id);

-- ---------------------------------------------------------------------------
-- RLS helpers (docs/blueprint/09-security.md #2 — search_path fixed on every
-- SECURITY DEFINER function to avoid search_path hijacking).
-- ---------------------------------------------------------------------------

create or replace function core.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  )
$$;

create or replace function core.has_workspace_role(ws_id uuid, roles text[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and role = any(roles)
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS policies — separated by command (INSERT only evaluates WITH CHECK).
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "workspaces_select_own" on public.workspaces
  for select using (core.is_workspace_member(id));

create policy "workspaces_update_owner_admin" on public.workspaces
  for update
  using (core.has_workspace_role(id, array['owner', 'admin']))
  with check (core.has_workspace_role(id, array['owner', 'admin']));

-- Row creation happens server-side via a Server Action using the service
-- role (workspace + first membership are created together, see
-- src/app/(auth)/register/actions.ts) — no public INSERT policy on
-- workspaces is needed for the flows this migration supports today.

create policy "workspace_members_select_own" on public.workspace_members
  for select using (core.is_workspace_member(workspace_id));

create policy "workspace_members_update_owner_admin" on public.workspace_members
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_members_delete_owner_admin" on public.workspace_members
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
