-- Historial y errores del sync de leads, pedido por el usuario tras la Fase
-- A: (1) sync incremental — Sheets API v4 no expone un modifiedTime por fila
-- ni por hoja (eso es metadata de Drive, requeriría un scope OAuth nuevo,
-- re-consentimiento de cada workspace ya conectado); el "mecanismo
-- equivalente" es un hash del contenido completo de la hoja en
-- lead_sheet_connections.last_sheet_hash — si no cambió desde la corrida
-- anterior, el runner corta antes de procesar una sola fila. (2) un log
-- persistente por fila fallida en vez de solo console.error. (3) una tabla
-- de corridas para la pantalla de historial (creados/actualizados/omitidos/
-- fallidos por corrida, manual o por cron).

alter table public.lead_sheet_connections add column if not exists last_sheet_hash text;

create table public.lead_sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.lead_sheet_connections (id) on delete cascade,
  trigger text not null check (trigger in ('cron', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  -- error_message es a nivel de corrida (ej. "no se pudo leer la hoja") —
  -- distinto de los errores por fila, que van en lead_sheet_sync_row_errors.
  error_message text,
  rows_read int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count int not null default 0
);

create index lead_sheet_sync_runs_connection_idx on public.lead_sheet_sync_runs (connection_id, started_at desc);

alter table public.lead_sheet_sync_runs enable row level security;

create policy "lead_sheet_sync_runs_select" on public.lead_sheet_sync_runs
  for select using (
    exists (
      select 1 from public.lead_sheet_connections c
      where c.id = connection_id and core.is_workspace_member(c.workspace_id)
    )
  );
-- Sin policy de insert/update/delete — solo el runner (service role) escribe.

create table public.lead_sheet_sync_row_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.lead_sheet_sync_runs (id) on delete cascade,
  row_number int not null,
  row_key text,
  message text not null,
  created_at timestamptz not null default now()
);

create index lead_sheet_sync_row_errors_run_idx on public.lead_sheet_sync_row_errors (run_id);

alter table public.lead_sheet_sync_row_errors enable row level security;

create policy "lead_sheet_sync_row_errors_select" on public.lead_sheet_sync_row_errors
  for select using (
    exists (
      select 1 from public.lead_sheet_sync_runs r
      join public.lead_sheet_connections c on c.id = r.connection_id
      where r.id = run_id and core.is_workspace_member(c.workspace_id)
    )
  );
