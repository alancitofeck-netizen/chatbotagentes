-- Importador de Cartera (Fase 1) — Aseguradoras/Ramos-Subramos/Productos
-- become real workspace-scoped catalogs instead of free text on
-- advisor_policies, specifically so the bulk importer can "crear
-- automáticamente" and offer a real fuzzy-duplicate merge ("San Cristobal"
-- file value vs "San Cristóbal" existing row) — confirmed with the user.
-- Reusable beyond the importer (e.g. future selects in DealFormSheet), not
-- import-only scaffolding. RLS mirrors advisor_policies exactly
-- (0010_advisors_module.sql): select=any member, insert/update=owner/admin/
-- agent (a solo self-service Agent workspace has no owner/admin at all —
-- provision-workspace.ts — so it must be able to create its own catalog
-- rows), delete=owner/admin only.

create table if not exists public.insurers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  -- Lowercased/unaccented/whitespace-collapsed form of `name`, computed in
  -- application code (src/lib/advisors/import/fuzzyMatch.ts's
  -- normalizeForMatch) — not a generated column, since the exact same
  -- normalizer must also run client-side during Paso 5's fuzzy-match
  -- preview before anything is written.
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, normalized_name)
);

create index if not exists insurers_workspace_id_idx on public.insurers (workspace_id);

alter table public.insurers enable row level security;

drop policy if exists "insurers_select" on public.insurers;
create policy "insurers_select" on public.insurers
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "insurers_insert" on public.insurers;
create policy "insurers_insert" on public.insurers
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "insurers_update" on public.insurers;
create policy "insurers_update" on public.insurers
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "insurers_delete" on public.insurers;
create policy "insurers_delete" on public.insurers
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Ramo/Subramo as one self-referential tree instead of two tables —
-- parent_branch_id null = Ramo (top level), set = Subramo. A plain
-- unique(workspace_id, parent_branch_id, normalized_name) would NOT dedupe
-- top-level Ramos against each other (Postgres treats every NULL as
-- distinct in a unique index), hence the two partial unique indexes below.
create table if not exists public.insurance_branches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_branch_id uuid references public.insurance_branches (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists insurance_branches_workspace_id_idx on public.insurance_branches (workspace_id);
create index if not exists insurance_branches_parent_id_idx on public.insurance_branches (parent_branch_id);

create unique index if not exists insurance_branches_unique_ramo
  on public.insurance_branches (workspace_id, normalized_name)
  where parent_branch_id is null;
create unique index if not exists insurance_branches_unique_subramo
  on public.insurance_branches (workspace_id, parent_branch_id, normalized_name)
  where parent_branch_id is not null;

alter table public.insurance_branches enable row level security;

drop policy if exists "insurance_branches_select" on public.insurance_branches;
create policy "insurance_branches_select" on public.insurance_branches
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "insurance_branches_insert" on public.insurance_branches;
create policy "insurance_branches_insert" on public.insurance_branches
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "insurance_branches_update" on public.insurance_branches;
create policy "insurance_branches_update" on public.insurance_branches
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "insurance_branches_delete" on public.insurance_branches;
create policy "insurance_branches_delete" on public.insurance_branches
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- A product always belongs to exactly one insurer (branch is optional —
-- not every imported row will have a resolvable Ramo/Subramo). Branch
-- deliberately excluded from the uniqueness key: the same product name
-- under the same insurer is already a strong-enough key, and a product
-- appearing under two different branch classifications in messy real-world
-- data shouldn't create two rows.
create table if not exists public.insurance_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  insurer_id uuid not null references public.insurers (id) on delete cascade,
  branch_id uuid references public.insurance_branches (id) on delete set null,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, insurer_id, normalized_name)
);

create index if not exists insurance_products_workspace_id_idx on public.insurance_products (workspace_id);
create index if not exists insurance_products_insurer_id_idx on public.insurance_products (insurer_id);

alter table public.insurance_products enable row level security;

drop policy if exists "insurance_products_select" on public.insurance_products;
create policy "insurance_products_select" on public.insurance_products
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "insurance_products_insert" on public.insurance_products;
create policy "insurance_products_insert" on public.insurance_products
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "insurance_products_update" on public.insurance_products;
create policy "insurance_products_update" on public.insurance_products
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
drop policy if exists "insurance_products_delete" on public.insurance_products;
create policy "insurance_products_delete" on public.insurance_products
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
