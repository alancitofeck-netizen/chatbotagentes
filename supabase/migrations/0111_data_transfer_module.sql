-- Módulo "Importar / Exportar" — centro de migración/sincronización de
-- datos. 5 tablas reales (no las 6 "conceptuales" pedidas: "Historial" se
-- resuelve como una consulta que UNIONa data_import_jobs + data_export_jobs
-- por fecha, no una tabla redundante que habría que mantener sincronizada
-- con las otras dos — mismo criterio "Reutilización explícita" del resto
-- del proyecto).
create table public.data_import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type text not null check (entity_type in ('contacts', 'prospects', 'policies', 'payments', 'events', 'tasks')),
  file_name text not null,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  total_rows int not null default 0,
  success_count int not null default 0,
  error_count int not null default 0,
  duplicate_count int not null default 0,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index data_import_jobs_workspace_idx on public.data_import_jobs (workspace_id, created_at desc);

create table public.data_import_errors (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.data_import_jobs (id) on delete cascade,
  row_number int not null,
  message text not null,
  raw_data jsonb
);

create index data_import_errors_job_idx on public.data_import_errors (job_id);

create table public.data_export_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type text not null,
  format text not null check (format in ('csv', 'xlsx', 'pdf', 'ics')),
  file_name text not null,
  record_count int not null default 0,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index data_export_jobs_workspace_idx on public.data_export_jobs (workspace_id, created_at desc);

-- Presets de mapeo de columnas guardados por workspace — la próxima vez que
-- suban "el mismo Excel de siempre" no tienen que remapear a mano.
create table public.data_column_mapping_presets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type text not null,
  name text not null,
  mapping jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, entity_type, name)
);

create table public.data_backups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  storage_path text not null,
  size_bytes bigint not null default 0,
  entity_counts jsonb not null default '{}',
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index data_backups_workspace_idx on public.data_backups (workspace_id, created_at desc);

alter table public.data_import_jobs enable row level security;
alter table public.data_import_errors enable row level security;
alter table public.data_export_jobs enable row level security;
alter table public.data_column_mapping_presets enable row level security;
alter table public.data_backups enable row level security;

create policy data_import_jobs_select on public.data_import_jobs for select using (core.is_workspace_member(workspace_id));
create policy data_import_jobs_insert on public.data_import_jobs for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy data_import_errors_select on public.data_import_errors for select using (
  exists (select 1 from public.data_import_jobs j where j.id = job_id and core.is_workspace_member(j.workspace_id))
);
create policy data_import_errors_insert on public.data_import_errors for insert with check (
  exists (select 1 from public.data_import_jobs j where j.id = job_id and core.has_workspace_role(j.workspace_id, array['owner', 'admin', 'agent']))
);

create policy data_export_jobs_select on public.data_export_jobs for select using (core.is_workspace_member(workspace_id));
create policy data_export_jobs_insert on public.data_export_jobs for insert with check (core.is_workspace_member(workspace_id));

create policy data_column_mapping_presets_select on public.data_column_mapping_presets for select using (core.is_workspace_member(workspace_id));
create policy data_column_mapping_presets_insert on public.data_column_mapping_presets for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy data_column_mapping_presets_delete on public.data_column_mapping_presets for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

-- Backups: solo Owner/Admin (contiene un volcado completo de la cartera del
-- workspace, más sensible que cualquier otra fila de esta migración).
create policy data_backups_select on public.data_backups for select using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy data_backups_insert on public.data_backups for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy data_backups_delete on public.data_backups for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals', 'ai_assistant', 'insurance_providers', 'data_transfer'));

-- Mismo patrón que el bucket "documents" (0019): privado, paths con prefijo
-- {workspace_id}/..., RLS vía core.is_workspace_member/has_workspace_role —
-- acá restringido a owner/admin (igual que las tablas de arriba) porque un
-- backup es un volcado completo de la cartera del workspace.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

create policy "backups_storage_select" on storage.objects
  for select using (
    bucket_id = 'backups' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

create policy "backups_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'backups' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );

create policy "backups_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'backups' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );
