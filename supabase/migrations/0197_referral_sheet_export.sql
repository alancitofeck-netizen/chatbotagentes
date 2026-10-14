-- Exportar Referidos (Asesorías > Referidos) a una Google Sheet elegida por
-- el workspace — agrupados por lead, con deduplicación real (nunca
-- re-escribe una fila ya exportada, la actualiza en el lugar). Mismo
-- mecanismo OAuth genérico que el resto de las integraciones de Google
-- (0018_calendar_oauth_credentials.sql: integration_connections + Vault +
-- upsert_oauth_credentials/get_oauth_credentials), con un provider propio
-- 'google_sheets_export' de ESCRITURA (scope spreadsheets, no
-- spreadsheets.readonly) — separado del 'google_sheets' existente (solo
-- lectura, usado por KPIs/Hojas de asesores) para no forzar una
-- reconexión silenciosa de esas conexiones ya activas al ampliar su scope.

alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('ycloud', 'openrouter', 'highlevel', 'google_calendar', 'calendly', 'google_drive', 'google_sheets', 'google_account', 'instagram', 'manychat', 'google_sheets_export'));

-- Nuevo estado de referido: "Agendó cita" — confirmado con el usuario,
-- distinto de "Convertido" (agendar no es cerrar la venta). Mismo token
-- 'cita_agendada' que ya usa mini_app_leads.status para el mismo concepto.
alter table public.asesoria_referrals drop constraint if exists asesoria_referrals_status_check;
alter table public.asesoria_referrals add constraint asesoria_referrals_status_check
  check (status in ('nuevo', 'contactado', 'interesado', 'no_interesado', 'cita_agendada', 'convertido'));

-- Config de la exportación — una fila por workspace (mismo criterio que
-- kpi_sheet_connections en 0033_kpi_module.sql antes de volverse per-setter:
-- acá sí es per-workspace de verdad, un solo destino). start_row/column_map
-- son configurables desde el modal "Exportar referidos a hoja" porque el
-- formato de la hoja de destino ya existe y no lo define este sistema.
create table public.referral_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  spreadsheet_id text not null,
  sheet_name text not null,
  start_row int not null default 3,
  -- {"numero":"A","lead":"B","nombre":"C","telefono":"D","agendo":"E"}
  column_map jsonb not null default '{"numero":"A","lead":"B","nombre":"C","telefono":"D","agendo":"E"}',
  status text not null default 'active' check (status in ('active', 'paused')),
  last_synced_at timestamptz,
  last_sync_status text not null default 'pending' check (last_sync_status in ('pending', 'ok', 'error')),
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referral_sheet_connections enable row level security;

create policy "referral_sheet_connections_select" on public.referral_sheet_connections
  for select using (core.is_workspace_member(workspace_id));
create policy "referral_sheet_connections_insert" on public.referral_sheet_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "referral_sheet_connections_update" on public.referral_sheet_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "referral_sheet_connections_delete" on public.referral_sheet_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Deduplicación real: una fila acá = un referido ya exportado, con la fila
-- de la hoja donde quedó. referral_id es unique -> re-exportar el mismo
-- referido es un no-op (o un update de la columna "Agendó" si cambió el
-- estado), nunca un alta duplicada. exported_status guarda el status del
-- referido al momento de la última escritura, para saber si hay que
-- actualizar la columna E la próxima vez que se procese. Solo la toca el
-- service role (el runner corre con ese cliente), igual criterio que
-- advisor_sheet_rows (0145_unify_advisor_sheet_sync.sql).
create table public.referral_sheet_exports (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.referral_sheet_connections (id) on delete cascade,
  referral_id uuid not null unique references public.asesoria_referrals (id) on delete cascade,
  sheet_row_number int,
  exported_status text,
  last_export_status text not null default 'pending' check (last_export_status in ('pending', 'ok', 'error')),
  last_export_error text,
  exported_at timestamptz,
  created_at timestamptz not null default now()
);

create index referral_sheet_exports_connection_idx on public.referral_sheet_exports (connection_id);
create index referral_sheet_exports_pending_idx on public.referral_sheet_exports (last_export_status) where last_export_status = 'pending';

alter table public.referral_sheet_exports enable row level security;

create policy "referral_sheet_exports_select" on public.referral_sheet_exports
  for select using (
    exists (
      select 1 from public.referral_sheet_connections c
      where c.id = connection_id and core.is_workspace_member(c.workspace_id)
    )
  );

-- Claim-then-finalize para el cron de reintentos (mismo patrón que
-- claim_pending_kpi_syncs, 0035_kpi_setter_sheets.sql): toma hasta
-- p_limit filas 'pending', las devuelve con todo lo necesario para
-- re-intentar sin otra consulta (referral + connection ya resueltos).
create or replace function public.claim_pending_referral_exports(p_limit int default 20)
returns table (
  export_id uuid,
  referral_id uuid,
  workspace_id uuid
)
language sql
security definer
set search_path = ''
as $$
  select e.id, e.referral_id, c.workspace_id
  from public.referral_sheet_exports e
  join public.referral_sheet_connections c on c.id = e.connection_id
  where e.id in (
    select id from public.referral_sheet_exports
    where last_export_status = 'pending'
    order by created_at asc
    limit p_limit
    for update skip locked
  )
  and c.status = 'active';
$$;

revoke all on function public.claim_pending_referral_exports(int) from public;
revoke all on function public.claim_pending_referral_exports(int) from anon;
revoke all on function public.claim_pending_referral_exports(int) from authenticated;
grant execute on function public.claim_pending_referral_exports(int) to service_role;

-- pg_cron + pg_net cada 3 minutos, mismo gate de "solo producción" que
-- 0034_pgcron_kpi_sync.sql. El bearer no se setea acá — insertarlo en Vault
-- como 'cron_sync_referral_exports_bearer', mismo valor que CRON_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $gate$
begin
  if to_regclass('private.app_config') is not null then
  if exists (select 1 from private.app_config where key = 'environment' and value = 'production') then
    perform cron.schedule(
  'sync-referral-exports',
  '*/3 * * * *',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/sync-referral-exports',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_referral_exports_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
  end if;
  end if;
end
$gate$;
