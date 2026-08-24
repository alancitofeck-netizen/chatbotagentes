-- Agente IA de Cartera — Fase 1 (infraestructura). Extiende el módulo
-- "Aseguradoras" (0107_insurance_providers_module.sql) en vez de crear
-- tablas paralelas: insurance_connections YA es "portal_connections",
-- insurance_sync_jobs YA es "portfolio_sync_jobs", policies YA tiene
-- insurance_connection_id. El único método real hoy era 'manual' — esta
-- migración habilita 'portal' de punta a punta (credenciales seguras +
-- estado de sync granular), sin tocar el flujo manual existente.

-- 1. Credenciales del portal — mismo patrón que integration_connections +
-- Vault (0018_calendar_oauth_credentials.sql), pero colgado de
-- insurance_connections porque el modelo "una fila por proveedor por
-- workspace" ya existe ahí.
alter table public.insurance_connections add column if not exists credentials_vault_ref text;

-- 2. Dominio permitido por aseguradora para el login por portal — ninguna
-- fila tiene uno confirmado todavía (ver comentario de 0107: no hay acceso
-- real a ningún portal todavía), queda NULL para las 12 sembradas. La UI
-- bloquea "Conectar por portal" mientras esto sea NULL, en vez de aceptar
-- cualquier URL.
alter table public.insurance_providers add column if not exists portal_domain text;

-- 3. Estado granular de sync — se AMPLÍA el check existente (no se
-- reemplaza 'processing'/'completed'/'failed', que la carga manual sigue
-- usando tal cual) y se agregan columnas de progreso, todas nullable/con
-- default, para no romper ninguna fila ni consulta existente.
alter table public.insurance_sync_jobs drop constraint if exists insurance_sync_jobs_status_check;
alter table public.insurance_sync_jobs add constraint insurance_sync_jobs_status_check
  check (status in (
    'processing', 'completed', 'failed',
    'queued', 'starting', 'authenticating', 'navigating', 'extracting',
    'normalizing', 'syncing', 'analyzing', 'cancelled', 'requires_user_action'
  ));

alter table public.insurance_sync_jobs add column if not exists current_step text;
alter table public.insurance_sync_jobs add column if not exists total_count int;
alter table public.insurance_sync_jobs add column if not exists processed_count int;
alter table public.insurance_sync_jobs add column if not exists updated_count int;
alter table public.insurance_sync_jobs add column if not exists cancelled_count int;
alter table public.insurance_sync_jobs add column if not exists cancel_requested boolean not null default false;

-- 4. Campos de póliza que el flujo manual no necesitaba pero un sync de
-- portal sí: external_id (identificador propio del portal, para upsert
-- incremental — distinto de policy_number, que puede repetirse/faltar),
-- renewal_date (distinto de end_date, pedido explícito del usuario:
-- "vencimiento" y "próxima renovación" pueden ser fechas distintas),
-- last_synced_at (para detectar pólizas que dejaron de aparecer = posible
-- cancelación, en una futura pasada).
alter table public.policies add column if not exists external_id text;
alter table public.policies add column if not exists renewal_date date;
alter table public.policies add column if not exists last_synced_at timestamptz;

alter table public.policies drop constraint if exists policies_source_check;
alter table public.policies add constraint policies_source_check
  check (source in ('manual', 'pdf_ai', 'import', 'portal_sync'));

-- Clave real para upsert incremental por conexión — dos conexiones
-- distintas (o una póliza cargada a mano, sin connection_id) nunca
-- colisionan entre sí.
create unique index if not exists policies_connection_external_id_idx
  on public.policies (insurance_connection_id, external_id)
  where external_id is not null;

-- 5. Vault RPCs — mismo patrón exacto que upsert_oauth_credentials/
-- get_oauth_credentials (0018), pero por connection_id en vez de
-- (workspace_id, provider): el caller siempre tiene ya la fila de
-- insurance_connections resuelta (se crea/asegura antes de guardar
-- credenciales, mismo criterio que confirmInsuranceManualSyncAction).
create or replace function public.upsert_portal_credentials(
  p_connection_id uuid,
  p_secret_json text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_secret_id uuid;
begin
  select workspace_id, credentials_vault_ref into v_workspace_id, v_secret_id
  from public.insurance_connections
  where id = p_connection_id;

  if v_workspace_id is null then
    raise exception 'connection not found';
  end if;

  if not core.has_workspace_role(v_workspace_id, array['owner', 'admin', 'agent']) then
    raise exception 'not authorized to manage this connection';
  end if;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_secret_json);
  else
    v_secret_id := vault.create_secret(p_secret_json, 'portal_connection:' || p_connection_id::text);
    update public.insurance_connections set credentials_vault_ref = v_secret_id where id = p_connection_id;
  end if;
end;
$$;

revoke all on function public.upsert_portal_credentials(uuid, text) from public;
revoke all on function public.upsert_portal_credentials(uuid, text) from anon;
grant execute on function public.upsert_portal_credentials(uuid, text) to authenticated;

-- Lectura del secreto en texto plano — únicamente el Worker (su propio
-- SUPABASE_SERVICE_ROLE_KEY) puede ejecutar esto. Nunca authenticated,
-- nunca el frontend, nunca un contexto de IA.
create or replace function public.get_portal_credentials(p_connection_id uuid)
returns table (secret_json text)
language sql
security definer
set search_path = ''
stable
as $$
  select ds.decrypted_secret
  from public.insurance_connections ic
  join vault.decrypted_secrets ds on ds.id = ic.credentials_vault_ref::uuid
  where ic.id = p_connection_id
  limit 1;
$$;

revoke all on function public.get_portal_credentials(uuid) from public;
revoke all on function public.get_portal_credentials(uuid) from anon;
revoke all on function public.get_portal_credentials(uuid) from authenticated;
grant execute on function public.get_portal_credentials(uuid) to service_role;
