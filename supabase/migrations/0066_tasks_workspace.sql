-- Tasks module redesign: promotes "Tareas" from a CRM tab to a first-class
-- Workspace module (/tasks). Adds columns to the existing `tasks` table plus
-- 3 new tables (checklist items, tag join table, multi-relation join table).
-- Comments/attachments/activity reuse existing generic primitives (notes,
-- documents, audit_log) with no schema change — see the app-level plan.
--
-- `tasks.related_type`/`related_id` (0002_crm_and_dashboard.sql) is left
-- untouched — it's still what CardDetailSheet's opportunity-scoped "Tareas"
-- tab reads/writes. `task_relations` below is additive: it allows a task to
-- relate to N records across several entity types at once, for the new
-- full-page task view's relations panel.

alter table public.tasks
  add column if not exists position integer not null default 0,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists description_json jsonb;

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_checklist_items_task_idx
  on public.task_checklist_items (task_id, position);

-- Reuses public.tags (0003_inbox.sql) — same shape as contact_tags.
create table if not exists public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);
create index if not exists task_tags_tag_id_idx on public.task_tags (tag_id);

-- "contact"/"conversation"/"opportunity" mirror the values tasks.related_type
-- already uses in the app (src/lib/tasks/queries.ts's TaskRelatedType).
-- "opportunity" also stands in for "Pipeline" (pipeline_items are
-- opportunities). "advisor_policy" is the real Pólizas table
-- (0010_advisors_module.sql). "Clientes" and "Contactos" both map to
-- "contact" — there is no separate Cliente entity in this schema.
create table if not exists public.task_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  related_type text not null check (related_type in ('contact', 'conversation', 'opportunity', 'advisor_policy', 'event', 'document')),
  related_id uuid not null,
  created_at timestamptz not null default now(),
  unique (task_id, related_type, related_id)
);
create index if not exists task_relations_task_idx on public.task_relations (task_id);
create index if not exists task_relations_lookup_idx on public.task_relations (related_type, related_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.task_checklist_items enable row level security;
alter table public.task_tags enable row level security;
alter table public.task_relations enable row level security;

create policy "task_checklist_items_select" on public.task_checklist_items
  for select using (core.is_workspace_member(workspace_id));
-- More permissive than tasks_delete (owner/admin only): a checklist item is
-- child content of a task, not the task record itself — an agent should be
-- able to manage their own task's sub-list without needing admin.
create policy "task_checklist_items_write" on public.task_checklist_items
  for all
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

-- task_tags/task_relations scope through their parent task's workspace_id,
-- same pattern already used for contact_tags (0003_inbox.sql) via contacts.
create policy "task_tags_select" on public.task_tags
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_tags.task_id and core.is_workspace_member(t.workspace_id)
    )
  );
create policy "task_tags_write" on public.task_tags
  for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_tags.task_id
        and core.has_workspace_role(t.workspace_id, array['owner', 'admin', 'agent'])
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_tags.task_id
        and core.has_workspace_role(t.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

create policy "task_relations_select" on public.task_relations
  for select using (core.is_workspace_member(workspace_id));
create policy "task_relations_write" on public.task_relations
  for all
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

-- ---------------------------------------------------------------------------
-- workspace_modules gains "tasks" (same drop/re-add pattern used for
-- ats/advisors/mini_apps).
-- ---------------------------------------------------------------------------

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks'));

-- Backfill: force-enable "tasks" for every existing workspace, same
-- reasoning/pattern as 0065_mini_apps_default_enabled.sql — module
-- activation is owner/admin-only, so an agent-only workspace could never
-- turn it on itself. provisionDefaultWorkspaceIfNeeded is updated in the
-- same app change to force-enable it for workspaces created from now on.
insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'tasks', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'tasks'
)
on conflict (workspace_id, module_key) do update set enabled = true;
