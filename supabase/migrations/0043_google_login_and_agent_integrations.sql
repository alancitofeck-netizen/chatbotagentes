-- Two changes for "Sign in / Sign up with Google" as a primary auth path:
--
-- 1. New provider 'google_account' — the login/identity OAuth grant, kept
--    distinct from google_calendar/google_sheets/google_drive on purpose:
--    integration_connections has a GLOBAL unique (provider, external_account_id)
--    constraint (0011_integration_connections.sql), so reusing an existing
--    provider value for login would collide the moment the same Google
--    account signs into a second workspace.
--
-- 2. Agents can now connect integrations too (WhatsApp/Google/OpenRouter).
--    Every integration write path today (RLS below + all four upsert/
--    disconnect RPCs) is owner/admin-only — but the corrected role-
--    permissions architecture (0039_role_permissions_system.sql) means a
--    self-registered account is always role 'agent' with NO owner/admin in
--    their own workspace. Without this fix, no solo agent could EVER
--    connect any integration, contradicting the explicit spec ("Agent
--    puede: conectar WhatsApp, conectar Google, conectar APIs").

alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('ycloud', 'openrouter', 'highlevel', 'google_calendar', 'calendly', 'google_drive', 'google_sheets', 'google_account'));

drop policy if exists "integration_connections_insert" on public.integration_connections;
create policy "integration_connections_insert" on public.integration_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "integration_connections_update" on public.integration_connections;
create policy "integration_connections_update" on public.integration_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "integration_connections_delete" on public.integration_connections;
create policy "integration_connections_delete" on public.integration_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create or replace function public.upsert_whatsapp_integration(
  p_workspace_id uuid,
  p_external_account_id text,
  p_api_key text default null,
  p_display_name text default null
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
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin', 'agent']) then
    raise exception 'not authorized to manage integrations for this workspace';
  end if;

  select id, credentials_vault_ref into v_connection_id, v_secret_id
  from public.integration_connections
  where workspace_id = p_workspace_id and provider = 'ycloud';

  if v_secret_id is null and p_api_key is null then
    raise exception 'api key is required to create a new whatsapp integration';
  end if;

  if p_api_key is not null then
    if v_secret_id is not null then
      perform vault.update_secret(v_secret_id, p_api_key);
    else
      v_secret_id := vault.create_secret(p_api_key, 'ycloud_api_key:' || p_workspace_id::text);
    end if;
  end if;

  if v_connection_id is not null then
    update public.integration_connections
    set external_account_id = p_external_account_id,
        credentials_vault_ref = v_secret_id,
        status = 'active',
        metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{display_name}', to_jsonb(p_display_name))
    where id = v_connection_id;
  else
    insert into public.integration_connections
      (workspace_id, provider, external_account_id, credentials_vault_ref, status, metadata)
    values
      (p_workspace_id, 'ycloud', p_external_account_id, v_secret_id, 'active', jsonb_build_object('display_name', p_display_name))
    returning id into v_connection_id;
  end if;

  return v_connection_id;
end;
$$;

create or replace function public.disconnect_whatsapp_integration(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin', 'agent']) then
    raise exception 'not authorized to manage integrations for this workspace';
  end if;

  update public.integration_connections
  set status = 'inactive'
  where workspace_id = p_workspace_id and provider = 'ycloud';
end;
$$;

create or replace function public.upsert_openrouter_integration(
  p_workspace_id uuid,
  p_api_key text default null,
  p_display_name text default null
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
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin', 'agent']) then
    raise exception 'not authorized to manage integrations for this workspace';
  end if;

  select id, credentials_vault_ref into v_connection_id, v_secret_id
  from public.integration_connections
  where workspace_id = p_workspace_id and provider = 'openrouter';

  if v_secret_id is null and p_api_key is null then
    raise exception 'api key is required to create a new openrouter integration';
  end if;

  if p_api_key is not null then
    if v_secret_id is not null then
      perform vault.update_secret(v_secret_id, p_api_key);
    else
      v_secret_id := vault.create_secret(p_api_key, 'openrouter_api_key:' || p_workspace_id::text);
    end if;
  end if;

  if v_connection_id is not null then
    update public.integration_connections
    set credentials_vault_ref = v_secret_id,
        status = 'active',
        metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{display_name}', to_jsonb(p_display_name))
    where id = v_connection_id;
  else
    insert into public.integration_connections
      (workspace_id, provider, external_account_id, credentials_vault_ref, status, metadata)
    values
      (p_workspace_id, 'openrouter', p_workspace_id::text, v_secret_id, 'active', jsonb_build_object('display_name', p_display_name))
    returning id into v_connection_id;
  end if;

  return v_connection_id;
end;
$$;

create or replace function public.disconnect_openrouter_integration(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin', 'agent']) then
    raise exception 'not authorized to manage integrations for this workspace';
  end if;

  update public.integration_connections
  set status = 'inactive'
  where workspace_id = p_workspace_id and provider = 'openrouter';
end;
$$;

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
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin', 'agent']) then
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

create or replace function public.disconnect_oauth_integration(p_workspace_id uuid, p_provider text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin', 'agent']) then
    raise exception 'not authorized to manage integrations for this workspace';
  end if;

  update public.integration_connections
  set status = 'inactive'
  where workspace_id = p_workspace_id and provider = p_provider;
end;
$$;

-- Bootstrap-only write path for the Google sign-in grant
-- (src/lib/integrations/googleAccount.ts) — called right after
-- provisionDefaultWorkspaceIfNeeded creates the brand-new workspace, i.e.
-- before the caller necessarily has a readable session in that same
-- request. Granted ONLY to service_role (never authenticated/anon), same
-- trust model as get_oauth_credentials (0018) — no has_workspace_role check
-- needed since only our own trusted server code can invoke it. Accepts
-- p_metadata (google id/name/picture/connected_at) since
-- upsert_oauth_credentials has no metadata param.
create or replace function public.store_google_account_grant(
  p_workspace_id uuid,
  p_external_account_id text,
  p_secret_json text,
  p_metadata jsonb
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
  select id, credentials_vault_ref into v_connection_id, v_secret_id
  from public.integration_connections
  where workspace_id = p_workspace_id and provider = 'google_account';

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_secret_json);
  else
    v_secret_id := vault.create_secret(p_secret_json, 'google_account_oauth:' || p_workspace_id::text);
  end if;

  if v_connection_id is not null then
    update public.integration_connections
    set external_account_id = p_external_account_id,
        credentials_vault_ref = v_secret_id,
        status = 'active',
        metadata = p_metadata
    where id = v_connection_id;
  else
    insert into public.integration_connections
      (workspace_id, provider, external_account_id, credentials_vault_ref, status, metadata)
    values
      (p_workspace_id, 'google_account', p_external_account_id, v_secret_id, 'active', p_metadata)
    returning id into v_connection_id;
  end if;

  return v_connection_id;
end;
$$;

revoke all on function public.store_google_account_grant(uuid, text, text, jsonb) from public;
revoke all on function public.store_google_account_grant(uuid, text, text, jsonb) from anon;
revoke all on function public.store_google_account_grant(uuid, text, text, jsonb) from authenticated;
grant execute on function public.store_google_account_grant(uuid, text, text, jsonb) to service_role;
