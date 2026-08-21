-- Fix de la migración anterior (0159): copié la rama 'logged_out' desde la
-- versión VIEJA de esta función (0050), que todavía borraba de
-- `whatsapp_web_credentials` — esa tabla fue eliminada hace rato por 0052
-- (RemoteAuth guarda el blob de sesión en Supabase Storage, no en Postgres;
-- el worker borra el blob viejo por su cuenta, ver whatsAppWebJsProvider.ts).
-- Esta versión es la de 0052 + la rama 'auth_failed' nueva, sin la línea
-- que refería a una tabla que ya no existe.
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

  -- 'auth_failed' se trata igual que 'logged_out': el worker borra el blob
  -- de Storage viejo por su cuenta (ver whatsAppWebJsProvider.ts), acá solo
  -- se rota la key de Vault y se limpia el estado visible.
  if v_status in ('logged_out', 'auth_failed') then
    select credentials_vault_ref into v_old_secret_id
    from public.whatsapp_web_sessions where id = v_session_id;

    v_secret_id := vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'whatsapp_web_session_key:' || p_workspace_id::text || ':' || p_member_id::text || ':' || v_session_id::text || ':' || extract(epoch from clock_timestamp())::text
    );
    update public.whatsapp_web_sessions
    set status = 'connecting', credentials_vault_ref = v_secret_id, qr_data = null, qr_expires_at = null,
        phone_e164 = null, device_name = null, disconnect_reason = null, updated_at = now()
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
