-- Grupos de Tareas: pivots the Tasks/Workspace module (0066_tasks_workspace.sql)
-- from one flat workspace-wide task list into Notion-style project pages.
-- Every task now belongs to exactly one group (`tasks.group_id`); a lazily
-- auto-provisioned `is_default` group ("General") catches tasks created by
-- flows that don't know about groups (CardDetailSheet's opportunity mini-form,
-- ConversationThread's quick "Crear tarea"), so nothing becomes orphaned.

create table public.task_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  icon text not null default '📁',
  -- Restricted to the 6 semantic tokens Badge.tsx already defines — no new
  -- hues introduced, same principle as the rest of this module.
  color text not null default 'accent' check (color in ('neutral', 'accent', 'success', 'warning', 'error', 'info')),
  cover_image_url text,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  is_default boolean not null default false,
  position integer not null default 0,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_groups_workspace_idx on public.task_groups (workspace_id, position);

alter table public.tasks add column group_id uuid references public.task_groups (id) on delete set null;
create index tasks_group_idx on public.tasks (group_id, status, position);

-- ---------------------------------------------------------------------------
-- RLS — same shape as tasks itself (0002_crm_and_dashboard.sql). Delete is
-- kept owner/admin (defense in depth) even though the UI only ever exposes
-- Archivar, never a hard-delete button.
-- ---------------------------------------------------------------------------

alter table public.task_groups enable row level security;

create policy "task_groups_select" on public.task_groups
  for select using (core.is_workspace_member(workspace_id));
create policy "task_groups_insert" on public.task_groups
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "task_groups_update" on public.task_groups
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "task_groups_delete" on public.task_groups
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- Storage bucket for optional group covers — same shape as mini-app-logos
-- (0062_mini_apps_public_pages.sql): public bucket, its own SELECT policy
-- (the Storage upload endpoint's INSERT ... RETURNING needs it even on a
-- public bucket), ownership scoped by joining back to task_groups.workspace_id.
-- No crop/resize — a cover banner doesn't need face-centering, uploaded as-is.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('task-group-covers', 'task-group-covers', true)
on conflict (id) do nothing;

create policy "task_group_covers_storage_select" on storage.objects
  for select using (bucket_id = 'task-group-covers');

create policy "task_group_covers_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'task-group-covers'
    and exists (
      select 1 from public.task_groups tg
      where tg.id::text = (storage.foldername(name))[1]
        and core.has_workspace_role(tg.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

create policy "task_group_covers_storage_update" on storage.objects
  for update using (
    bucket_id = 'task-group-covers'
    and exists (
      select 1 from public.task_groups tg
      where tg.id::text = (storage.foldername(name))[1]
        and core.has_workspace_role(tg.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

create policy "task_group_covers_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'task-group-covers'
    and exists (
      select 1 from public.task_groups tg
      where tg.id::text = (storage.foldername(name))[1]
        and core.has_workspace_role(tg.workspace_id, array['owner', 'admin', 'agent'])
    )
  );
