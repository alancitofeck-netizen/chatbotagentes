-- "Asesores" module: a new product vertical for insurance agents / financial
-- advisors, requested directly by the user ("Marketplace" mentioned earlier
-- as context, now confirmed as a real activatable module). Not in the
-- Blueprint at all — the only "Marketplace" mention there (08-integrations.md)
-- is HighLevel's own partner app, unrelated. Confirmed scope: re-skinned CRM
-- reusing the core pipeline/contacts/notes engine, with policy_type/
-- renewal_date/commission as the only vertical-specific data. Sales Navigator
-- import stays explicitly deferred.
--
-- module_key check constraints are real CHECK constraints today (confirmed via
-- pg_get_constraintdef before writing this), not just a "catalog row" as
-- 03-modules.md implies — must be extended, this is a real schema change.
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors'));

alter table public.pipelines drop constraint if exists pipelines_module_key_check;
alter table public.pipelines add constraint pipelines_module_key_check
  check (module_key in ('crm', 'ats', 'advisors'));

-- 1:1 extension of `opportunities`, same pattern as `candidates` extending
-- `contacts` (0004_ats.sql) — policy_type/renewal_date/commission don't belong
-- on the generic core Opportunities table, only this vertical.
create table if not exists public.advisor_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null unique references public.opportunities (id) on delete cascade,
  policy_type text,
  renewal_date date,
  commission numeric,
  created_at timestamptz not null default now()
);

create index if not exists advisor_policies_workspace_id_idx on public.advisor_policies (workspace_id);

alter table public.advisor_policies enable row level security;

create policy "advisor_policies_select" on public.advisor_policies
  for select using (core.is_workspace_member(workspace_id));
create policy "advisor_policies_insert" on public.advisor_policies
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "advisor_policies_update" on public.advisor_policies
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "advisor_policies_delete" on public.advisor_policies
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
