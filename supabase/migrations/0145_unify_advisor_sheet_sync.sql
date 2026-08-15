-- Unifica lead_sheet_connections + appointment_sheet_connections en una
-- sola conexión por asesor (Leads + Agenda + KPIs de Agenda desde la misma
-- hoja/fila) — reemplaza ambos sistemas paralelos. Verificado que ambas
-- tablas viejas están vacías en producción (0 filas), así que se
-- reemplazan directamente en vez de migrar datos.
--
-- Diferencia de diseño clave respecto a appointment_sheet_connections: el
-- asesor ya NO se resuelve fila-por-fila por fuzzy-match del texto de la
-- columna ASESOR (permitía mezclar varios asesores en una hoja) — ahora
-- queda fijo en advisor_client_id al crear la conexión (una hoja = un
-- asesor = una conexión, elegido de un dropdown).
create table public.advisor_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  advisor_client_id uuid not null references public.clients (id) on delete cascade,
  spreadsheet_id text not null,
  sheet_gid text,
  sheet_name text not null,
  -- { "<encabezado de la columna>": "<campo destino, ver advisorSync/fieldDictionary.ts>" }
  column_map jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused')),
  last_synced_at timestamptz,
  last_sheet_hash text,
  last_sync_status text not null default 'pending' check (last_sync_status in ('pending', 'ok', 'error')),
  last_sync_error text,
  row_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, advisor_client_id)
);

create index advisor_sheet_connections_workspace_idx on public.advisor_sheet_connections (workspace_id);

alter table public.advisor_sheet_connections enable row level security;

create policy "advisor_sheet_connections_select" on public.advisor_sheet_connections
  for select using (core.is_workspace_member(workspace_id));
create policy "advisor_sheet_connections_insert" on public.advisor_sheet_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "advisor_sheet_connections_update" on public.advisor_sheet_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "advisor_sheet_connections_delete" on public.advisor_sheet_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Identidad estable por fila — 'ext:<id>' si el usuario mapeó una columna de
-- ID externo, si no 'row:<N>'. contact_id/appointment_id/opportunity_id
-- viven en el workspace REAL del asesor (advisor_client_id.linked_workspace_id),
-- no acá. Solo la toca el service role (nunca RLS de cliente).
create table public.advisor_sheet_rows (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.advisor_sheet_connections (id) on delete cascade,
  row_key text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  appointment_id uuid references public.agenda_appointments (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  status text not null default 'ok' check (status in ('ok', 'error')),
  error_message text,
  last_row_hash text not null,
  synced_at timestamptz not null default now(),
  unique (connection_id, row_key)
);

create index advisor_sheet_rows_connection_idx on public.advisor_sheet_rows (connection_id);

alter table public.advisor_sheet_rows enable row level security;

create policy "advisor_sheet_rows_select" on public.advisor_sheet_rows
  for select using (
    exists (
      select 1 from public.advisor_sheet_connections c
      where c.id = connection_id and core.is_workspace_member(c.workspace_id)
    )
  );

-- Historial de corridas (retomado de lead_sheet_sync_runs/row_errors,
-- 0085_lead_sheet_sync_history.sql — appointment_sheet_connections no lo
-- tenía, se suma acá sin perder nada).
create table public.advisor_sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.advisor_sheet_connections (id) on delete cascade,
  trigger text not null check (trigger in ('cron', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  error_message text,
  rows_read int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count int not null default 0
);

create index advisor_sheet_sync_runs_connection_idx on public.advisor_sheet_sync_runs (connection_id, started_at desc);

alter table public.advisor_sheet_sync_runs enable row level security;

create policy "advisor_sheet_sync_runs_select" on public.advisor_sheet_sync_runs
  for select using (
    exists (
      select 1 from public.advisor_sheet_connections c
      where c.id = connection_id and core.is_workspace_member(c.workspace_id)
    )
  );

create table public.advisor_sheet_sync_row_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.advisor_sheet_sync_runs (id) on delete cascade,
  row_number int not null,
  row_key text,
  message text not null,
  created_at timestamptz not null default now()
);

create index advisor_sheet_sync_row_errors_run_idx on public.advisor_sheet_sync_row_errors (run_id);

alter table public.advisor_sheet_sync_row_errors enable row level security;

create policy "advisor_sheet_sync_row_errors_select" on public.advisor_sheet_sync_row_errors
  for select using (
    exists (
      select 1 from public.advisor_sheet_sync_runs r
      join public.advisor_sheet_connections c on c.id = r.connection_id
      where r.id = run_id and core.is_workspace_member(c.workspace_id)
    )
  );

-- Claim atómico para el cron — mismo patrón FOR UPDATE SKIP LOCKED que
-- claim_pending_appointment_sheet_syncs (0140_agenda_sheet_sync_claim.sql).
create or replace function public.claim_pending_advisor_sheet_syncs(p_limit int default 20)
returns setof public.advisor_sheet_connections
language sql
security definer
set search_path = ''
as $$
  update public.advisor_sheet_connections
  set last_synced_at = now()
  where id in (
    select id from public.advisor_sheet_connections
    where status = 'active'
    order by last_synced_at asc nulls first
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_advisor_sheet_syncs(int) from public;
revoke all on function public.claim_pending_advisor_sheet_syncs(int) from anon;
revoke all on function public.claim_pending_advisor_sheet_syncs(int) from authenticated;
grant execute on function public.claim_pending_advisor_sheet_syncs(int) to service_role;

-- Reemplaza los dos cron jobs viejos (cada 2 min, mismo mecanismo pg_cron +
-- pg_net que 0084/0141) por uno solo. El secreto se reutiliza vía Vault
-- fuera de banda bajo el nombre 'cron_sync_advisor_sheets_bearer' (copiado
-- del valor ya existente de CRON_SECRET, no se define acá).
select cron.unschedule('sync-lead-sheets');
select cron.unschedule('sync-appointment-sheets');

select cron.schedule(
  'sync-advisor-sheets',
  '*/2 * * * *',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/sync-advisor-sheets',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_advisor_sheets_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- Baja de las tablas/funciones viejas — 0 filas reales verificadas antes de
-- este drop (lead_sheet_connections, lead_sheet_rows, appointment_sheet_connections,
-- appointment_sheet_rows), así que no hace falta backfill.
drop function if exists public.claim_pending_lead_sheet_syncs(int);
drop function if exists public.claim_pending_appointment_sheet_syncs(int);
drop table if exists public.lead_sheet_sync_row_errors;
drop table if exists public.lead_sheet_sync_runs;
drop table if exists public.lead_sheet_rows;
drop table if exists public.lead_sheet_connections;
drop table if exists public.appointment_sheet_rows;
drop table if exists public.appointment_sheet_connections;
