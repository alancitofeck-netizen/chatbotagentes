-- Wires real per-workspace credential storage for the WhatsApp (YCloud)
-- integration. `integration_connections.credentials_vault_ref`
-- (0011_integration_connections.sql) has existed since last pass but was
-- never populated — the actual send path still reads a single shared
-- `process.env.YCLOUD_API_KEY` for every workspace, which is the exact
-- single-tenant gap this migration's plumbing exists to close.
--
-- docs/blueprint/08-integrations.md (line 9) is explicit: "la clave real en
-- Supabase Vault (credentials_vault_ref), nunca en texto plano en la tabla
-- ni en variables de entorno compartidas entre workspaces." No new table is
-- created — `integration_connections` (02-database.md) is already the
-- documented workspace↔external-account mapping the YCloud webhook resolves
-- against, so a parallel `whatsapp_integrations` table would just duplicate
-- it. Provider-specific display data goes in the existing `metadata` jsonb
-- column, same "no migration for one extra label" pattern already used for
-- contacts.custom_fields.job_title.
--
-- IMPORTANT: this migration only prepares storage + management (Settings UI
-- writes here). The webhook (src/app/api/webhooks/ycloud/route.ts) and the
-- send route (src/app/api/messages/send/route.ts) are NOT modified in this
-- pass — they keep reading the shared env var until a follow-up pass wires
-- consumption.
--
-- supabase_vault (0.3.1) is already enabled on this project, but its
-- functions live in the `vault` schema, which PostgREST does not expose and
-- to which `authenticated` has no grants — so a SECURITY DEFINER wrapper in
-- `public` is required, same reasoning as core.is_workspace_member /
-- core.has_workspace_role already being SECURITY DEFINER RLS helpers
-- (0001_workspaces_and_members.sql). Mirrors their `set search_path = ''`
-- + fully-qualified-name convention to avoid search_path hijacking.

-- `p_api_key` is optional: editing display name/phone alone (leaving the key
-- field blank in the UI, so an already-configured key is never re-typed)
-- must not touch Vault at all — only writing a *new* key does.
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
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin']) then
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

revoke all on function public.upsert_whatsapp_integration(uuid, text, text, text) from public;
grant execute on function public.upsert_whatsapp_integration(uuid, text, text, text) to authenticated;

-- Soft-disconnect (status='inactive') rather than deleting the row/secret —
-- reversible, and resolveWorkspaceId in the webhook already only matches
-- status='active' rows, so an inactive row is inert without losing history.
create or replace function public.disconnect_whatsapp_integration(p_workspace_id uuid)
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
  where workspace_id = p_workspace_id and provider = 'ycloud';
end;
$$;

revoke all on function public.disconnect_whatsapp_integration(uuid) from public;
grant execute on function public.disconnect_whatsapp_integration(uuid) to authenticated;
