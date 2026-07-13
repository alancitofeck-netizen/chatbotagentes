-- Spec: docs/blueprint/02-database.md:133-137. Management-only for now (create/
-- edit/list/enable-disable) — the Decision Engine that would actually dispatch
-- these rules (docs/blueprint/13-agent-engine.md) doesn't exist yet (no
-- Buffer Inteligente/YCloud/OpenRouter). Same "read/manage, not yet live"
-- posture already used for the Inbox module.
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  trigger jsonb not null default '{}',
  conditions jsonb not null default '{}',
  actions jsonb not null default '[]',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists automations_workspace_idx on public.automations (workspace_id);

alter table public.automations enable row level security;

create policy "automations_select" on public.automations
  for select using (core.is_workspace_member(workspace_id));
create policy "automations_insert" on public.automations
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "automations_update" on public.automations
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "automations_delete" on public.automations
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
