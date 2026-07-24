-- Role-based permissions system: exactly 3 workspace roles (owner/admin/
-- agent — 'viewer' dropped, confirmed unused in any real workspace before
-- this migration), a platform-wide superadmin concept ("Owner global") that
-- can read-only supervise ANY workspace without merging data, and a
-- last_active_at column backing the "última actividad" fallback for the
-- real-time presence feature (Supabase Realtime Presence itself is
-- ephemeral/in-memory and needs no table — this column is only the
-- persisted "last seen" for when nobody is currently connected).

-- ---------------------------------------------------------------------------
-- 1. Drop 'viewer' — confirmed no real workspace_members row uses it.
-- ---------------------------------------------------------------------------
alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'agent'));

-- ---------------------------------------------------------------------------
-- 2. Presence fallback column.
-- ---------------------------------------------------------------------------
alter table public.workspace_members add column if not exists last_active_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Platform admins ("Owner global") — a short allow-list, deliberately not
-- a workspace_members row (a platform admin isn't a member of every
-- workspace they can supervise). RLS restricted to self-read only; nothing
-- in the app writes to this table except this migration's seed insert —
-- promoting a new platform admin is a manual, out-of-band operation on
-- purpose (this is a superadmin capability, not something any in-app role
-- should be able to grant itself or anyone else).
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists "platform_admins_select_self" on public.platform_admins;
create policy "platform_admins_select_self" on public.platform_admins
  for select using (auth.uid() = user_id);

create or replace function core.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- Seed: alancitofeck@gmail.com is the one Owner global account (confirmed
-- with the user).
insert into public.platform_admins (user_id)
values ('08e67a64-1e93-402d-bac3-64b2be246dae')
on conflict (user_id) do nothing;

-- Public-schema wrapper — core.* functions aren't exposed over PostgREST,
-- so the app (src/lib/auth/roles.ts's requirePlatformAdmin) calls this via
-- supabase.rpc('am_i_platform_admin') instead of querying platform_admins
-- directly (the table's own RLS already limits a self-select to one's own
-- row anyway, but a single boolean RPC is simpler at every call site).
create or replace function public.am_i_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select core.is_platform_admin()
$$;

-- ---------------------------------------------------------------------------
-- 4. Extend is_workspace_member to also grant platform admins read access —
-- this ONE change is what makes "supervisar cualquier workspace sin mezclar
-- datos" work automatically across every existing "any member reads" RLS
-- policy in the app (contacts/conversations/opportunities/bookings/
-- documents/kpi_entries/tasks/...), with zero changes needed to any
-- individual policy or query function. has_workspace_role (the function
-- every WRITE policy uses) is intentionally left untouched — a platform
-- admin has no real workspace_members row in a workspace they're
-- supervising, so has_workspace_role still correctly returns false for them
-- there, keeping supervision strictly read-only at the RLS layer regardless
-- of whatever role the app assigns them client-side for that session.
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
  ) or core.is_platform_admin()
$$;

-- ---------------------------------------------------------------------------
-- 5. The one write policy in the whole schema that used is_workspace_member
-- instead of has_workspace_role (agent_test_runs insert, 0024_ai_agents_core.sql)
-- — fixed to the standard write convention so step 4 doesn't incidentally
-- grant platform admins (or, previously, 'viewer') insert access here.
-- ---------------------------------------------------------------------------
drop policy if exists "agent_test_runs_insert" on public.agent_test_runs;
create policy "agent_test_runs_insert" on public.agent_test_runs
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
