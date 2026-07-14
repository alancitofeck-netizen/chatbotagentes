-- OpenRouter (LLM gateway) credential storage — mirrors
-- 0012_whatsapp_integration_vault.sql / 0013_whatsapp_credentials_lookup.sql
-- exactly (same SECURITY DEFINER / search_path='' / grant split). Per
-- docs/blueprint/08-integrations.md + 09-security.md's RBAC table
-- ("Gestionar integraciones (YCloud/OpenRouter/HighLevel)" is owner/admin
-- only), OpenRouter is a PER-WORKSPACE connection, same as YCloud — each
-- workspace brings its own OpenRouter API key, never a shared platform key.
--
-- `integration_connections.provider` already allows 'openrouter'
-- (0011_integration_connections.sql), just unused until now.
--
-- Unlike YCloud, OpenRouter has no natural per-account external identifier
-- (one key per workspace, no phone-number-like id) — `external_account_id`
-- (not null, unique with provider) is satisfied by using `workspace_id::text`,
-- which trivially satisfies uniqueness without a schema change.

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
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin']) then
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

revoke all on function public.upsert_openrouter_integration(uuid, text, text) from public;
grant execute on function public.upsert_openrouter_integration(uuid, text, text) to authenticated;

create or replace function public.disconnect_openrouter_integration(p_workspace_id uuid)
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
  where workspace_id = p_workspace_id and provider = 'openrouter';
end;
$$;

revoke all on function public.disconnect_openrouter_integration(uuid) from public;
grant execute on function public.disconnect_openrouter_integration(uuid) to authenticated;

-- Credential read — service_role only, never callable from a request-scoped
-- client (same reasoning as get_whatsapp_credentials, 0013).
create or replace function public.get_openrouter_credentials(p_workspace_id uuid)
returns table (api_key text)
language sql
security definer
set search_path = ''
stable
as $$
  select ds.decrypted_secret
  from public.integration_connections ic
  join vault.decrypted_secrets ds on ds.id = ic.credentials_vault_ref::uuid
  where ic.workspace_id = p_workspace_id
    and ic.provider = 'openrouter'
    and ic.status = 'active'
  limit 1;
$$;

revoke all on function public.get_openrouter_credentials(uuid) from public;
revoke all on function public.get_openrouter_credentials(uuid) from anon;
revoke all on function public.get_openrouter_credentials(uuid) from authenticated;
grant execute on function public.get_openrouter_credentials(uuid) to service_role;
