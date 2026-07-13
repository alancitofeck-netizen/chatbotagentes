-- Generic OAuth credential storage for Google Calendar (this pass, real) and
-- Calendly (scaffold, future) — distinct from
-- upsert_whatsapp_integration/get_whatsapp_credentials (0012/0013), which
-- are shaped for a single plain API key. OAuth providers need a
-- token+refresh+expiry bundle, stored here as one JSON blob per Vault
-- secret. Same overall pattern: SECURITY DEFINER wrapper because PostgREST
-- doesn't expose `vault`, write-side checks core.has_workspace_role,
-- read-side (which returns the decrypted secret) restricted to service_role.
alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('ycloud', 'openrouter', 'highlevel', 'google_calendar', 'calendly'));

create or replace function public.upsert_oauth_credentials(
  p_workspace_id uuid,
  p_provider text,
  p_external_account_id text,
  p_secret_json text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection_id uuid;
  v_secret_id uuid;
begin
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin']) then
    raise exception 'not authorized to manage integrations for this workspace';
  end if;

  select id, credentials_vault_ref into v_connection_id, v_secret_id
  from public.integration_connections
  where workspace_id = p_workspace_id and provider = p_provider;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_secret_json);
  else
    v_secret_id := vault.create_secret(p_secret_json, p_provider || '_oauth:' || p_workspace_id::text);
  end if;

  if v_connection_id is not null then
    update public.integration_connections
    set external_account_id = p_external_account_id,
        credentials_vault_ref = v_secret_id,
        status = 'active'
    where id = v_connection_id;
  else
    insert into public.integration_connections
      (workspace_id, provider, external_account_id, credentials_vault_ref, status)
    values
      (p_workspace_id, p_provider, p_external_account_id, v_secret_id, 'active')
    returning id into v_connection_id;
  end if;

  return v_connection_id;
end;
$$;

revoke all on function public.upsert_oauth_credentials(uuid, text, text, text) from public;
revoke all on function public.upsert_oauth_credentials(uuid, text, text, text) from anon;
grant execute on function public.upsert_oauth_credentials(uuid, text, text, text) to authenticated;

create or replace function public.get_oauth_credentials(p_workspace_id uuid, p_provider text)
returns table (external_account_id text, secret_json text)
language sql
security definer
set search_path = ''
stable
as $$
  select ic.external_account_id, ds.decrypted_secret
  from public.integration_connections ic
  join vault.decrypted_secrets ds on ds.id = ic.credentials_vault_ref::uuid
  where ic.workspace_id = p_workspace_id
    and ic.provider = p_provider
    and ic.status = 'active'
  limit 1;
$$;

revoke all on function public.get_oauth_credentials(uuid, text) from public;
revoke all on function public.get_oauth_credentials(uuid, text) from anon;
revoke all on function public.get_oauth_credentials(uuid, text) from authenticated;
grant execute on function public.get_oauth_credentials(uuid, text) to service_role;

create or replace function public.disconnect_oauth_integration(p_workspace_id uuid, p_provider text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin']) then
    raise exception 'not authorized to manage integrations for this workspace';
  end if;

  update public.integration_connections
  set status = 'inactive'
  where workspace_id = p_workspace_id and provider = p_provider;
end;
$$;

revoke all on function public.disconnect_oauth_integration(uuid, text) from public;
revoke all on function public.disconnect_oauth_integration(uuid, text) from anon;
grant execute on function public.disconnect_oauth_integration(uuid, text) to authenticated;
