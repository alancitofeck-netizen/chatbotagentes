-- "Documentos" module: folders + documents + sharing + favorites + a
-- version-history scaffold, backed by Supabase Storage. No `attachments`
-- table existed yet (docs/blueprint/02-database.md describes one, polymorphic
-- over message/contact/candidate_application, but it was never created —
-- verified via list_tables before writing this). `documents` doubles as that
-- future attachment mechanism via the optional related_type/related_id pair
-- (same polymorphic convention as notes/tasks/bookings) instead of building
-- a second, parallel file-storage concept later.
--
-- Storage: one shared private bucket `documents` with workspace-id-prefixed
-- paths ({workspace_id}/{document_id}/{filename}) + RLS on storage.objects —
-- the standard Supabase pattern for "isolated per workspace", instead of
-- provisioning a bucket per workspace (which would need bucket-creation
-- logic wired into workspace creation).
--
-- Google Drive: reuses the generic upsert_oauth_credentials/get_oauth_credentials
-- RPC pair from 0018_calendar_oauth_credentials.sql (built generic on purpose)
-- — just widens the provider check constraint, no new RPCs.

alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('ycloud', 'openrouter', 'highlevel', 'google_calendar', 'calendly', 'google_drive'));

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_folder_id uuid references public.folders (id) on delete cascade,
  name text not null,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  owner_id uuid references public.workspace_members (id) on delete set null,
  last_modified_by uuid references public.workspace_members (id) on delete set null,
  source text not null default 'upload'
    check (source in ('upload', 'google_drive', 'google_docs', 'google_sheets', 'export')),
  external_id text,
  -- Same polymorphic pattern as tasks.related_type/related_id and
  -- bookings.related_type/related_id — no CHECK constraint, plain text,
  -- recognized values are an app-code convention (see eventTypeMeta-style
  -- constants when this gets wired to a CRM "Archivos" tab).
  related_type text,
  related_id uuid,
  is_trashed boolean not null default false,
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_favorites (
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, document_id)
);

create table if not exists public.document_permissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  unique (document_id, member_id)
);

-- Structure prepared, not populated by app code this pass (per explicit ask
-- to leave version history "ready" rather than fully wired).
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  storage_path text not null,
  size_bytes bigint,
  version_number int not null,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists folders_workspace_idx on public.folders (workspace_id, parent_folder_id);
create index if not exists documents_workspace_idx on public.documents (workspace_id, folder_id, is_trashed);
create index if not exists documents_related_idx on public.documents (related_type, related_id);
create index if not exists document_permissions_document_idx on public.document_permissions (document_id);
create index if not exists document_versions_document_idx on public.document_versions (document_id, version_number);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_favorites enable row level security;
alter table public.document_permissions enable row level security;
alter table public.document_versions enable row level security;

-- folders/documents: same generic pattern as contacts/tasks (member reads,
-- owner/admin/agent write — 'viewer' role is read-only app-wide; owner/admin
-- deletes, see 0002_crm_and_dashboard.sql).
create policy "folders_select" on public.folders
  for select using (core.is_workspace_member(workspace_id));
create policy "folders_insert" on public.folders
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "folders_update" on public.folders
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "folders_delete" on public.folders
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "documents_select" on public.documents
  for select using (core.is_workspace_member(workspace_id));
create policy "documents_insert" on public.documents
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "documents_update" on public.documents
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
-- Delete (papelera -> eliminar definitivo): owner/admin role, OR the
-- document's own owner — same criterion as bookings_delete plus an
-- allowance for whoever uploaded it to clean up their own file.
create policy "documents_delete" on public.documents
  for delete using (
    core.has_workspace_role(workspace_id, array['owner', 'admin'])
    or exists (
      select 1 from public.workspace_members m
      where m.id = documents.owner_id and m.user_id = auth.uid()
    )
  );

-- Favorites are per-member, not per-workspace-role — a member can only ever
-- touch their own favorite rows, for documents in their own workspace.
create policy "document_favorites_all" on public.document_favorites
  for all
  using (
    exists (
      select 1 from public.workspace_members m
      join public.documents d on d.workspace_id = m.workspace_id
      where m.id = document_favorites.member_id and m.user_id = auth.uid() and d.id = document_favorites.document_id
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members m
      join public.documents d on d.workspace_id = m.workspace_id
      where m.id = document_favorites.member_id and m.user_id = auth.uid() and d.id = document_favorites.document_id
    )
  );

-- Sharing: any workspace member can see who a document is shared with;
-- managing the share list is owner/admin/agent or the document's own owner.
create policy "document_permissions_select" on public.document_permissions
  for select using (
    exists (select 1 from public.documents d where d.id = document_permissions.document_id and core.is_workspace_member(d.workspace_id))
  );
create policy "document_permissions_write" on public.document_permissions
  for all
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_permissions.document_id
        and (
          core.has_workspace_role(d.workspace_id, array['owner', 'admin', 'agent'])
          or exists (select 1 from public.workspace_members m where m.id = d.owner_id and m.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_permissions.document_id
        and (
          core.has_workspace_role(d.workspace_id, array['owner', 'admin', 'agent'])
          or exists (select 1 from public.workspace_members m where m.id = d.owner_id and m.user_id = auth.uid())
        )
    )
  );

create policy "document_versions_select" on public.document_versions
  for select using (
    exists (select 1 from public.documents d where d.id = document_versions.document_id and core.is_workspace_member(d.workspace_id))
  );
create policy "document_versions_insert" on public.document_versions
  for insert with check (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
        and core.has_workspace_role(d.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, workspace-id-prefixed paths
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'documents' and core.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'documents' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'agent'])
  );

create policy "documents_storage_update" on storage.objects
  for update using (
    bucket_id = 'documents' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'agent'])
  );

create policy "documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'documents' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );
