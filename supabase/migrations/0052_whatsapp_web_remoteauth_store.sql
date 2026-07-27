-- Swaps the WhatsApp Web worker's underlying library from Baileys to
-- whatsapp-web.js (user decision — see worker/whatsapp-connector/README.md).
-- whatsapp-web.js's RemoteAuth auth strategy persists session state
-- completely differently from Baileys: instead of many small Signal-protocol
-- keys, it zips the ENTIRE Chromium profile directory into one blob and
-- hands it to a pluggable Store (sessionExists/save/extract/delete). That
-- blob is now stored encrypted in Supabase Storage instead of Postgres rows
-- — whatsapp_web_credentials (0051) doesn't fit this shape at all and is
-- dropped. whatsapp_web_sessions (0050) and get_whatsapp_web_session_key
-- (0051) are untouched — the per-session Vault key they already provide is
-- reused as-is to encrypt/decrypt the new Storage blob.
drop table if exists public.whatsapp_web_credentials;

-- Same body as 0050/0050e's provision_whatsapp_web_session, minus the
-- `delete from whatsapp_web_credentials` line in the logged_out branch (that
-- table no longer exists) — the worker itself now deletes the old Storage
-- blob during its own logout/reprovision handling, since a Postgres function
-- has no way to reach Supabase Storage directly.
create or replace function public.provision_whatsapp_web_session(
  p_workspace_id uuid,
  p_member_id uuid
)
returns table (session_id uuid, fresh_login boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_status text;
  v_secret_id uuid;
  v_old_secret_id uuid;
  v_target_role text;
begin
  v_target_role := core.member_role_of(p_member_id);

  if not (
    core.is_own_member_row(p_member_id)
    or core.has_workspace_role(p_workspace_id, array['owner'])
    or (core.has_workspace_role(p_workspace_id, array['admin']) and v_target_role <> 'owner')
  ) then
    raise exception 'not authorized to manage this WhatsApp Web connection';
  end if;

  select id, status into v_session_id, v_status
  from public.whatsapp_web_sessions
  where workspace_id = p_workspace_id and member_id = p_member_id;

  if v_session_id is null then
    v_secret_id := vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'whatsapp_web_session_key:' || p_workspace_id::text || ':' || p_member_id::text
    );
    insert into public.whatsapp_web_sessions (workspace_id, member_id, status, credentials_vault_ref)
    values (p_workspace_id, p_member_id, 'connecting', v_secret_id)
    returning id into v_session_id;
    return query select v_session_id, true;
    return;
  end if;

  if v_status = 'logged_out' then
    -- A real logout invalidates the whole session — a fresh key, the worker
    -- deletes the old Storage blob on its own (see events/logout handling in
    -- providers/whatsAppWebJsProvider.ts), never reuse of the old key.
    select credentials_vault_ref into v_old_secret_id
    from public.whatsapp_web_sessions where id = v_session_id;

    v_secret_id := vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'whatsapp_web_session_key:' || p_workspace_id::text || ':' || p_member_id::text || ':' || v_session_id::text || ':' || extract(epoch from clock_timestamp())::text
    );
    update public.whatsapp_web_sessions
    set status = 'connecting', credentials_vault_ref = v_secret_id, qr_data = null, qr_expires_at = null,
        phone_e164 = null, device_name = null, updated_at = now()
    where id = v_session_id;

    if v_old_secret_id is not null then
      delete from vault.secrets where id = v_old_secret_id;
    end if;

    return query select v_session_id, true;
    return;
  end if;

  if v_status = 'disconnected' then
    update public.whatsapp_web_sessions
    set status = 'connecting', updated_at = now()
    where id = v_session_id;
    return query select v_session_id, false;
    return;
  end if;

  return query select v_session_id, false;
end;
$$;

revoke all on function public.provision_whatsapp_web_session(uuid, uuid) from public;
grant execute on function public.provision_whatsapp_web_session(uuid, uuid) to authenticated;

-- Private bucket for the encrypted RemoteAuth session blobs — no
-- storage.objects policy for anon/authenticated at all (RLS enabled + no
-- policy = default-deny, same posture whatsapp_web_credentials used). Only
-- the worker's service-role client ever touches it.
insert into storage.buckets (id, name, public)
values ('whatsapp-web-sessions', 'whatsapp-web-sessions', false)
on conflict (id) do nothing;
