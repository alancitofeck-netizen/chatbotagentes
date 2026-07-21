-- Módulo KPIs (nueva pestaña dentro de /crm) — lee números semanales que cada
-- setter carga en una Google Sheet por workspace y los muestra 100% nativos
-- (cards, semanas, mensual, ranking, gráficos, objetivos), sin que nadie
-- tenga que abrir la hoja. Google Sheets es solo la fuente de datos.
--
-- Reutiliza la infraestructura OAuth genérica ya construida en
-- 0018_calendar_oauth_credentials.sql (integration_connections + Vault +
-- upsert_oauth_credentials/get_oauth_credentials/disconnect_oauth_integration)
-- agregando 'google_sheets' como un provider más — un token con el scope de
-- Calendar no puede leer Sheets (los tokens de Google están atados a
-- scopes), así que esto es una conexión OAuth separada, no una reutilización
-- literal del mismo token, aunque sí reutiliza el 100% del mismo mecanismo.
alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('ycloud', 'openrouter', 'highlevel', 'google_calendar', 'calendly', 'google_drive', 'google_sheets'));

-- Conexión de la hoja en sí (spreadsheet/pestaña elegida + estado de la
-- última sincronización). Tabla propia, no integration_connections.metadata:
-- ese jsonb hoy solo guarda un string estático escrito una vez
-- (display_name); esto se muta cada 3 minutos por el cron concurrentemente
-- con acciones del usuario (desconectar, cambiar hoja), y necesita mostrarse
-- de forma prominente en Configuración — columnas reales, no un blob.
create table if not exists public.kpi_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  spreadsheet_id text not null,
  sheet_gid text,
  sheet_name text,
  column_map jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive')),
  last_synced_at timestamptz,
  last_sync_status text not null default 'pending' check (last_sync_status in ('pending', 'ok', 'error')),
  last_sync_error text,
  row_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kpi_sheet_connections enable row level security;

drop policy if exists "kpi_sheet_connections_select" on public.kpi_sheet_connections;
create policy "kpi_sheet_connections_select" on public.kpi_sheet_connections
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "kpi_sheet_connections_insert" on public.kpi_sheet_connections;
create policy "kpi_sheet_connections_insert" on public.kpi_sheet_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "kpi_sheet_connections_update" on public.kpi_sheet_connections;
create policy "kpi_sheet_connections_update" on public.kpi_sheet_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "kpi_sheet_connections_delete" on public.kpi_sheet_connections;
create policy "kpi_sheet_connections_delete" on public.kpi_sheet_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Identidad estable de setter para el ranking, en vez de un texto libre en
-- cada fila de kpi_entries (una variación menor del nombre en la hoja no
-- debe "romper" el historial de un setter). linked_member_id es opcional —
-- vincular a un workspace_members real (para avatar, etc.) no es necesario
-- para que el módulo funcione.
create table if not exists public.kpi_setters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  display_name text not null,
  normalized_name text not null,
  linked_member_id uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, normalized_name)
);

create index if not exists kpi_setters_workspace_id_idx on public.kpi_setters (workspace_id);

alter table public.kpi_setters enable row level security;

drop policy if exists "kpi_setters_select" on public.kpi_setters;
create policy "kpi_setters_select" on public.kpi_setters
  for select using (core.is_workspace_member(workspace_id));
-- Solo insert/update vía service_role (el sync job) para las columnas de
-- identidad — RLS no distingue a nivel de columna, así que "vincular a un
-- member real" también pasa por esta misma policy de owner/admin; la acción
-- de la app solo envía linked_member_id en ese caso.
drop policy if exists "kpi_setters_update_link" on public.kpi_setters;
create policy "kpi_setters_update_link" on public.kpi_setters
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Filas semanales — única fuente de verdad (Mensual se calcula al vuelo con
-- SUM/GROUP BY, no se guarda aparte). Sin policy de insert/update/delete
-- para authenticated: con RLS activo y ninguna policy que matchee esos
-- comandos, quedan denegados por default — solo service_role (que bypasea
-- RLS) puede escribir, igual que las filas que escribe el webhook de YCloud.
create table if not exists public.kpi_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  setter_id uuid not null references public.kpi_setters (id) on delete cascade,
  period_month date not null,
  week_number smallint not null check (week_number between 1 and 4),
  conexion int not null default 0,
  conexiones_aceptadas int not null default 0,
  respuestas_primer_mensaje int not null default 0,
  primer_mensaje_enviado int not null default 0,
  en_conversacion int not null default 0,
  no_le_interesa int not null default 0,
  seguimiento_conversacion int not null default 0,
  seguimiento_agenda int not null default 0,
  agenda_manual int not null default 0,
  calificadas int not null default 0,
  source_row_hash text,
  is_stale boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_month, week_number, setter_id)
);

create index if not exists kpi_entries_workspace_period_idx on public.kpi_entries (workspace_id, period_month, week_number);

alter table public.kpi_entries enable row level security;

drop policy if exists "kpi_entries_select" on public.kpi_entries;
create policy "kpi_entries_select" on public.kpi_entries
  for select using (core.is_workspace_member(workspace_id));

-- Metas mensuales — a diferencia de kpi_entries/kpi_setters, esto lo edita
-- un admin desde la UI, no el job de sync: RLS normal de escritura, no
-- service-role-only.
create table if not exists public.kpi_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_month date not null,
  metric_key text not null,
  target_value int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_month, metric_key)
);

alter table public.kpi_goals enable row level security;

drop policy if exists "kpi_goals_select" on public.kpi_goals;
create policy "kpi_goals_select" on public.kpi_goals
  for select using (core.is_workspace_member(workspace_id));
drop policy if exists "kpi_goals_insert" on public.kpi_goals;
create policy "kpi_goals_insert" on public.kpi_goals
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "kpi_goals_update" on public.kpi_goals;
create policy "kpi_goals_update" on public.kpi_goals
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "kpi_goals_delete" on public.kpi_goals;
create policy "kpi_goals_delete" on public.kpi_goals
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Claim atómico por lote para el cron de sync (mismo patrón exacto que
-- claim_pending_conversation_buffers, 0020_agent_engine_core.sql): evita que
-- un tick de 3 minutos intente sincronizar los mismos workspaces que un tick
-- anterior todavía en curso, y reparte "cientos de workspaces" entre ticks
-- en vez de un loop síncrono sobre todos en una sola invocación. Actualiza
-- last_synced_at como "reclamo" optimista; el resultado real (ok/error,
-- row_count) se guarda después, en una escritura separada tras procesar.
create or replace function public.claim_pending_kpi_syncs(p_limit int default 20)
returns setof public.kpi_sheet_connections
language sql
security definer
set search_path = ''
as $$
  update public.kpi_sheet_connections
  set last_synced_at = now()
  where id in (
    select id from public.kpi_sheet_connections
    where status = 'active'
    order by last_synced_at asc nulls first
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_kpi_syncs(int) from public;
revoke all on function public.claim_pending_kpi_syncs(int) from anon;
revoke all on function public.claim_pending_kpi_syncs(int) from authenticated;
grant execute on function public.claim_pending_kpi_syncs(int) to service_role;
