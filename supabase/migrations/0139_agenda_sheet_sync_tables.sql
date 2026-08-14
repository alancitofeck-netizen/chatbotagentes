-- Sistema de Agendas — sincronización Google Sheets → Supabase de citas
-- setter→asesor. Clona el shape de lead_sheet_connections/lead_sheet_rows
-- (0082_lead_sheet_sync.sql) sin pipeline_id/default_stage_id (acá no se
-- crea ninguna oportunidad, solo una cita) — reutiliza la misma conexión
-- OAuth 'google_sheets' ya existente (integration_connections/Vault).
create table public.appointment_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  spreadsheet_id text not null,
  sheet_gid text,
  sheet_name text not null,
  -- { "<encabezado de la columna>": "<campo destino, ver appointmentSync/fieldDictionary.ts>" }
  column_map jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused')),
  last_synced_at timestamptz,
  -- hash del contenido completo de la última hoja leída — mismo mecanismo
  -- que lead_sheet_connections.last_sheet_hash (0085) para saltear toda la
  -- corrida cuando nada cambió, sin necesitar el scope de Drive modifiedTime.
  last_sheet_hash text,
  last_sync_status text not null default 'pending' check (last_sync_status in ('pending', 'ok', 'error')),
  last_sync_error text,
  row_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, spreadsheet_id, sheet_gid)
);

create index appointment_sheet_connections_workspace_idx on public.appointment_sheet_connections (workspace_id);

alter table public.appointment_sheet_connections enable row level security;

create policy "appointment_sheet_connections_select" on public.appointment_sheet_connections
  for select using (core.is_workspace_member(workspace_id));
create policy "appointment_sheet_connections_insert" on public.appointment_sheet_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "appointment_sheet_connections_update" on public.appointment_sheet_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "appointment_sheet_connections_delete" on public.appointment_sheet_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Identidad estable por fila (mismo criterio que lead_sheet_rows): 'ext:<id>'
-- si el setter mapeó una columna de ID externo, si no 'row:<N>'. contact_id
-- y booking_id viven en el workspace REAL del asesor (linked_workspace_id),
-- no acá — booking_id puede quedar null si la fila falló antes de crear la
-- cita (ver status/error_message). Solo la toca el service role.
create table public.appointment_sheet_rows (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.appointment_sheet_connections (id) on delete cascade,
  row_key text not null,
  booking_id uuid references public.bookings (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  status text not null default 'ok' check (status in ('ok', 'error')),
  error_message text,
  last_row_hash text not null,
  synced_at timestamptz not null default now(),
  unique (connection_id, row_key)
);

create index appointment_sheet_rows_connection_idx on public.appointment_sheet_rows (connection_id);

alter table public.appointment_sheet_rows enable row level security;

create policy "appointment_sheet_rows_select" on public.appointment_sheet_rows
  for select using (
    exists (
      select 1 from public.appointment_sheet_connections c
      where c.id = connection_id and core.is_workspace_member(c.workspace_id)
    )
  );
-- Sin policy de insert/update/delete: el runner (cron) siempre usa el
-- service-role client, mismo criterio que lead_sheet_rows.
