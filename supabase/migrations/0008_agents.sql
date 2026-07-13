-- "Agentes" module (team performance management inside CRM). Not specified in
-- the Blueprint — a new feature requested directly, confirmed with the user:
-- exact score formula (25% response rate + 25% conversion rate + 25% meeting
-- completion + 25% response speed) and a full `teams` entity.
--
-- workspace_members (core since 0001) gets additive, nullable/defaulted
-- columns — same justification pattern as contacts.company: doesn't touch
-- any existing read/write path, only adds new optional fields for this
-- feature. `title` (job title: Setter/SDR/Closer) is deliberately separate
-- from `role` (owner/admin/agent/viewer, which governs RLS/permissions) —
-- conflating the two would be wrong.
--
-- bookings gets `owner_id` because nothing today records which agent a
-- meeting belongs to — needed to attribute "reuniones agendadas/realizadas"
-- per agent.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  leader_id uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists teams_workspace_idx on public.teams (workspace_id);

alter table public.workspace_members
  add column if not exists title text,
  add column if not exists status text not null default 'active' check (status in ('active', 'vacation', 'inactive')),
  add column if not exists team_id uuid references public.teams (id) on delete set null,
  add column if not exists supervisor_id uuid references public.workspace_members (id) on delete set null,
  add column if not exists hire_date date;

alter table public.bookings
  add column if not exists owner_id uuid references public.workspace_members (id) on delete set null;

create table if not exists public.agent_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  metric text not null default 'meetings' check (metric in ('meetings')),
  period text not null check (period in ('week', 'month')),
  period_start date not null,
  target_value numeric not null,
  created_at timestamptz not null default now(),
  unique (member_id, metric, period, period_start)
);

create index if not exists agent_targets_member_idx on public.agent_targets (member_id, period, period_start);

alter table public.teams enable row level security;
alter table public.agent_targets enable row level security;

create policy "teams_select" on public.teams
  for select using (core.is_workspace_member(workspace_id));
create policy "teams_insert" on public.teams
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "teams_update" on public.teams
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "teams_delete" on public.teams
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "agent_targets_select" on public.agent_targets
  for select using (core.is_workspace_member(workspace_id));
create policy "agent_targets_insert" on public.agent_targets
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "agent_targets_update" on public.agent_targets
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "agent_targets_delete" on public.agent_targets
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
