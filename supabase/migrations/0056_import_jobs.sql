-- Importador de Cartera (Fase 1) — background processing engine. Same
-- claim-and-process shape already proven in production for
-- conversation-buffer flush (0020_agent_engine_core.sql) and KPI sheet sync
-- (0035_kpi_setter_sheets.sql): a SECURITY DEFINER function claims a batch
-- with `for update skip locked`, a pg_cron+pg_net tick (0057) drives a
-- Vercel Cron route that processes whatever it claims, repeatedly, until
-- the job is done. Needed because a 10,000-row import cannot run inside one
-- Vercel serverless invocation without hitting its execution timeout, and
-- must not block the wizard's UI either.

-- ---------------------------------------------------------------------------
-- import_jobs — one row per "Importar cartera" run. `module_key` is named
-- generically (not "advisors_import") so a future CRM/ATS bulk importer can
-- reuse this exact same engine instead of building a second one.
-- ---------------------------------------------------------------------------
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.workspace_members (id) on delete set null,
  module_key text not null default 'advisors' check (module_key in ('advisors')),
  source_file_name text not null,
  source_file_size bigint not null,
  storage_path text,
  sheet_name text,
  status text not null default 'draft'
    check (status in ('draft', 'mapped', 'analyzing', 'analyzed', 'configuring', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
  phase text not null default 'idle'
    check (phase in ('idle', 'lookups', 'clients', 'policies', 'renewals', 'finalizing', 'done')),
  column_mapping jsonb not null default '{}',
  config jsonb not null default '{}',
  analysis jsonb not null default '{}',
  totals jsonb not null default '{}',
  -- Resolved ONCE (via the existing ensurePipeline, src/lib/advisors/actions.ts)
  -- and cached here so the row loop never re-queries/re-provisions the
  -- pipeline per row across potentially thousands of policy inserts.
  pipeline_id uuid,
  default_stage_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists import_jobs_workspace_id_idx on public.import_jobs (workspace_id);
create index if not exists import_jobs_active_idx on public.import_jobs (status, created_at) where status in ('queued', 'processing');

alter table public.import_jobs enable row level security;

drop policy if exists "import_jobs_select" on public.import_jobs;
create policy "import_jobs_select" on public.import_jobs
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "import_jobs_insert" on public.import_jobs;
create policy "import_jobs_insert" on public.import_jobs
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "import_jobs_update" on public.import_jobs;
create policy "import_jobs_update" on public.import_jobs
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "import_jobs_delete" on public.import_jobs;
create policy "import_jobs_delete" on public.import_jobs
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- import_job_lookups — one row per DISTINCT insurer/branch/subbranch/product
-- name found in the file, queued for the "lookups" phase (resolve-or-create
-- against 0053's catalogs, with a fuzzy-match suggestion the user confirms
-- in Paso 5 before anything is written). workspace_id is denormalized here
-- (not joined through job_id) purely to keep RLS a plain column check
-- instead of an EXISTS subquery — same reasoning as public.notes carrying
-- its own workspace_id despite being polymorphic.
-- ---------------------------------------------------------------------------
create table if not exists public.import_job_lookups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type text not null check (entity_type in ('insurer', 'branch', 'subbranch', 'product')),
  file_value text not null,
  normalized_value text not null,
  -- Only set for 'product' (needs its insurer) and 'subbranch' (needs its
  -- Ramo) rows — resolved against sibling lookup rows of this same job by
  -- the row processor, not a DB foreign key (the parent may not be resolved
  -- yet when this row is inserted).
  parent_insurer_file_value text,
  parent_branch_file_value text,
  match_candidate_id uuid,
  match_score numeric,
  resolution text not null default 'pending' check (resolution in ('pending', 'create_new', 'use_existing', 'skip')),
  resolved_entity_id uuid,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  -- A plain unique constraint treats every NULL as distinct, so this does
  -- not fully dedupe rows where both parent_*_file_value columns are null
  -- (top-level 'insurer'/'branch' entries) — acceptable here because these
  -- rows are only ever inserted by this app's own analysis code, which
  -- already de-duplicates in memory before inserting; this constraint is a
  -- backstop, not the primary correctness guarantee (unlike 0053's
  -- user-facing catalog tables, where the partial unique indexes ARE the
  -- guarantee).
  unique (job_id, entity_type, normalized_value, parent_insurer_file_value, parent_branch_file_value)
);

create index if not exists import_job_lookups_job_id_idx on public.import_job_lookups (job_id, entity_type, status);

alter table public.import_job_lookups enable row level security;

drop policy if exists "import_job_lookups_select" on public.import_job_lookups;
create policy "import_job_lookups_select" on public.import_job_lookups
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "import_job_lookups_insert" on public.import_job_lookups;
create policy "import_job_lookups_insert" on public.import_job_lookups
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "import_job_lookups_update" on public.import_job_lookups;
create policy "import_job_lookups_update" on public.import_job_lookups
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

-- ---------------------------------------------------------------------------
-- import_job_rows — the up-to-10,000-row queue itself. `status` tracks
-- which phase last touched the row: pending → (claimed→processing) →
-- clients_done → (claimed→processing) → policies_done, or skipped/error at
-- any point. contact_action/policy_action are decided during Paso 5 (per-row
-- duplicate resolution) and finalized before insertion — contact_action:
-- 'skip' means the WHOLE row is skipped (a policy needs a client); a
-- policy_action of 'skip' ("Ignorar") only skips the policy half, the
-- contact is still created/updated normally.
-- ---------------------------------------------------------------------------
create table if not exists public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  row_number int not null,
  -- Canonical mapped field values for this row (post Paso 3 mapping),
  -- shaped like the InternalFieldKey registry in fieldDictionary.ts.
  data jsonb not null,
  contact_action text check (contact_action in ('create', 'update', 'skip')),
  matched_contact_id uuid,
  contact_id uuid,
  policy_action text check (policy_action in ('create', 'update', 'skip', 'duplicate')),
  matched_policy_id uuid,
  policy_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'clients_done', 'policies_done', 'skipped', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists import_job_rows_job_status_idx on public.import_job_rows (job_id, status);
create index if not exists import_job_rows_job_row_number_idx on public.import_job_rows (job_id, row_number);

alter table public.import_job_rows enable row level security;

drop policy if exists "import_job_rows_select" on public.import_job_rows;
create policy "import_job_rows_select" on public.import_job_rows
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "import_job_rows_insert" on public.import_job_rows;
create policy "import_job_rows_insert" on public.import_job_rows
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "import_job_rows_update" on public.import_job_rows;
create policy "import_job_rows_update" on public.import_job_rows
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

-- ---------------------------------------------------------------------------
-- Claim RPCs — service_role only (called exclusively from the cron route's
-- service-role client, never from a user session), `for update skip locked`
-- as the atomicity guarantee, scoped to one job at a time (the orchestrator
-- in jobRunner.ts iterates active jobs itself and calls these per job so
-- multiple concurrent imports across different workspaces never starve one
-- another).
-- ---------------------------------------------------------------------------
create or replace function public.claim_pending_import_lookups(p_job_id uuid, p_entity_type text, p_limit int default 50)
returns setof public.import_job_lookups
language sql
security definer
set search_path = ''
as $$
  update public.import_job_lookups
  set status = 'processing'
  where id in (
    select id from public.import_job_lookups
    where job_id = p_job_id and entity_type = p_entity_type and status = 'pending'
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_import_lookups(uuid, text, int) from public;
revoke all on function public.claim_pending_import_lookups(uuid, text, int) from anon;
revoke all on function public.claim_pending_import_lookups(uuid, text, int) from authenticated;
grant execute on function public.claim_pending_import_lookups(uuid, text, int) to service_role;

create or replace function public.claim_pending_import_rows_for_clients(p_job_id uuid, p_limit int default 300)
returns setof public.import_job_rows
language sql
security definer
set search_path = ''
as $$
  update public.import_job_rows
  set status = 'processing'
  where id in (
    select id from public.import_job_rows
    where job_id = p_job_id and status = 'pending'
    order by row_number
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_import_rows_for_clients(uuid, int) from public;
revoke all on function public.claim_pending_import_rows_for_clients(uuid, int) from anon;
revoke all on function public.claim_pending_import_rows_for_clients(uuid, int) from authenticated;
grant execute on function public.claim_pending_import_rows_for_clients(uuid, int) to service_role;

-- Smaller default batch than the client claim (150 vs 300) — each row here
-- does up to 3 writes (opportunity + pipeline_item + advisor_policies)
-- versus one contact upsert.
create or replace function public.claim_pending_import_rows_for_policies(p_job_id uuid, p_limit int default 150)
returns setof public.import_job_rows
language sql
security definer
set search_path = ''
as $$
  update public.import_job_rows
  set status = 'processing'
  where id in (
    select id from public.import_job_rows
    where job_id = p_job_id and status = 'clients_done'
    order by row_number
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_import_rows_for_policies(uuid, int) from public;
revoke all on function public.claim_pending_import_rows_for_policies(uuid, int) from anon;
revoke all on function public.claim_pending_import_rows_for_policies(uuid, int) from authenticated;
grant execute on function public.claim_pending_import_rows_for_policies(uuid, int) to service_role;

-- Private bucket for the original uploaded file + its parsed.json cache —
-- lives only for the wizard's lifetime, not part of the Documentos module.
-- No storage.objects policy for anon/authenticated at all (RLS enabled +
-- no policy = default-deny) — only the service-role client (used by both
-- the foreground actions and the cron route) ever touches it, same posture
-- as the whatsapp-web-sessions bucket (0052).
insert into storage.buckets (id, name, public)
values ('cartera_imports', 'cartera_imports', false)
on conflict (id) do nothing;
