-- ATS module (Kanban de reclutamiento): vacancies, candidates (1:1 extension of
-- contacts), candidate_applications. Spec: docs/blueprint/02-database.md
-- ("Módulo ATS"), docs/blueprint/07-ats.md. Reuses pipelines/pipeline_stages/
-- pipeline_items (0002) — each vacancy owns its own pipeline instance, unlike
-- CRM's single global sales pipeline. interviews/evaluations are deliberately
-- NOT migrated here — nothing uses them this sprint (07-ats.md flags the
-- interview/booking-provider default as still unconfirmed with the user).
-- core.is_workspace_member / core.has_workspace_role exist since 0001.

create table if not exists public.vacancies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text,
  department text,
  location text,
  status text not null default 'open' check (status in ('open', 'paused', 'closed')),
  pipeline_id uuid references public.pipelines (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null unique references public.contacts (id) on delete cascade,
  resume_attachment_id uuid, -- fk to attachments once that table exists (not migrated yet)
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  pipeline_item_id uuid references public.pipeline_items (id) on delete set null,
  status text not null default 'active',
  applied_at timestamptz not null default now(),
  unique (vacancy_id, candidate_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists vacancies_workspace_id_idx on public.vacancies (workspace_id);
create index if not exists candidates_workspace_id_idx on public.candidates (workspace_id);
create index if not exists candidate_applications_workspace_id_idx on public.candidate_applications (workspace_id);
create index if not exists candidate_applications_vacancy_idx on public.candidate_applications (vacancy_id);

-- ---------------------------------------------------------------------------
-- RLS — same pattern as 0002 (commands separated, WITH CHECK on writes).
-- candidate_applications carries its own workspace_id (like opportunities),
-- so it doesn't need a join through its parent the way pipeline_items does.
-- ---------------------------------------------------------------------------

alter table public.vacancies enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_applications enable row level security;

create policy "vacancies_select" on public.vacancies
  for select using (core.is_workspace_member(workspace_id));
create policy "vacancies_insert" on public.vacancies
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "vacancies_update" on public.vacancies
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "vacancies_delete" on public.vacancies
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "candidates_select" on public.candidates
  for select using (core.is_workspace_member(workspace_id));
create policy "candidates_insert" on public.candidates
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "candidates_update" on public.candidates
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy "candidate_applications_select" on public.candidate_applications
  for select using (core.is_workspace_member(workspace_id));
create policy "candidate_applications_insert" on public.candidate_applications
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "candidate_applications_update" on public.candidate_applications
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
