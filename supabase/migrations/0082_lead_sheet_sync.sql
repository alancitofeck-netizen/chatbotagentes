-- Sincronización Google Sheets → CRM, Fase A (motor de sync, un solo
-- sentido). Reutiliza la conexión OAuth 'google_sheets' ya existente
-- (0033_kpi_module.sql — integration_connections/Vault) para leer la hoja;
-- esta migración solo agrega qué hoja/columnas/pipeline usar para crear
-- leads, no una conexión OAuth nueva.

create table public.lead_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  spreadsheet_id text not null,
  sheet_gid text,
  sheet_name text not null,
  -- { "<encabezado de la columna>": "<campo destino, ver fieldDictionary.ts>" }
  column_map jsonb not null default '{}',
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  default_stage_id uuid not null references public.pipeline_stages (id) on delete set null,
  default_owner_id uuid references public.workspace_members (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused')),
  last_synced_at timestamptz,
  last_sync_status text not null default 'pending' check (last_sync_status in ('pending', 'ok', 'error')),
  last_sync_error text,
  row_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, spreadsheet_id, sheet_gid)
);

create index lead_sheet_connections_workspace_idx on public.lead_sheet_connections (workspace_id);

alter table public.lead_sheet_connections enable row level security;

create policy "lead_sheet_connections_select" on public.lead_sheet_connections
  for select using (core.is_workspace_member(workspace_id));
create policy "lead_sheet_connections_insert" on public.lead_sheet_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "lead_sheet_connections_update" on public.lead_sheet_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "lead_sheet_connections_delete" on public.lead_sheet_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Identidad estable por fila de la hoja — sin esto, cada corrida del sync
-- no tendría forma de saber "esta fila ya generó un lead, actualizalo" vs.
-- "es nueva, creá uno". `row_key` es la columna "ID externo" que el usuario
-- puede mapear opcionalmente (ver fieldDictionary.ts); si no la mapea, el
-- runner arma la clave como 'row:<N>' (número de fila) — documentado como
-- limitación: insertar/borrar filas en el medio de la hoja puede reasociar
-- una fila con el lead equivocado si no hay una columna de ID real.
-- Solo la toca el service role (nunca RLS de cliente).
create table public.lead_sheet_rows (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.lead_sheet_connections (id) on delete cascade,
  row_key text not null,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  last_row_hash text not null,
  synced_at timestamptz not null default now(),
  unique (connection_id, row_key)
);

create index lead_sheet_rows_connection_idx on public.lead_sheet_rows (connection_id);

alter table public.lead_sheet_rows enable row level security;

create policy "lead_sheet_rows_select" on public.lead_sheet_rows
  for select using (
    exists (
      select 1 from public.lead_sheet_connections c
      where c.id = connection_id and core.is_workspace_member(c.workspace_id)
    )
  );
-- Sin policy de insert/update/delete: el runner (cron) siempre usa el
-- service-role client, mismo criterio que mini_app_leads/ingest.ts.
