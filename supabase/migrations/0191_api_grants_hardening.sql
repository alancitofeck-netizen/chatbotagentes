-- Paridad de permisos EXECUTE de las funciones de public con producción, más el cierre de
-- anon y PUBLIC en las funciones que no lo necesitan (sección 3 de la evaluación de 2026-10-05).
-- Para cada función: se quitan todos los privilegios de PUBLIC, anon y
-- authenticated, y se vuelven a conceder sólo los que tiene producción
-- (ver la matriz verificada en 2026-10-05). Dos excepciones que cierran agujeros
-- sin uso desde la app (ver docs/mobile/proceso-migraciones.md):
--   get_user_id_by_email(text): sólo service_role (sin anon, public ni authenticated).
--   provision_whatsapp_web_session(uuid,uuid): sin anon (sólo authenticated y service_role).
-- Incluye 0012b (revoke de anon sobre upsert/disconnect_whatsapp_integration), que
-- ya estaba aplicado en producción y faltaba en el repo.
-- Idempotente.

revoke all on function public.agency_workspace_id() from public, anon, authenticated;
grant execute on function public.agency_workspace_id() to authenticated, service_role;
revoke all on function public.am_i_platform_admin() from public, anon, authenticated;
grant execute on function public.am_i_platform_admin() to authenticated, service_role;
revoke all on function public.claim_pending_advisor_sheet_syncs(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_advisor_sheet_syncs(integer) to service_role;
revoke all on function public.claim_pending_conversation_buffers(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_conversation_buffers(integer) to service_role;
revoke all on function public.claim_pending_import_lookups(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.claim_pending_import_lookups(uuid,text,integer) to service_role;
revoke all on function public.claim_pending_import_rows_for_clients(uuid,integer) from public, anon, authenticated;
grant execute on function public.claim_pending_import_rows_for_clients(uuid,integer) to service_role;
revoke all on function public.claim_pending_import_rows_for_policies(uuid,integer) from public, anon, authenticated;
grant execute on function public.claim_pending_import_rows_for_policies(uuid,integer) to service_role;
revoke all on function public.claim_pending_kpi_syncs(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_kpi_syncs(integer) to service_role;
revoke all on function public.classroom_user_names(uuid[]) from public, anon, authenticated;
grant execute on function public.classroom_user_names(uuid[]) to authenticated, service_role;
revoke all on function public.clear_processed_buffer_messages(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.clear_processed_buffer_messages(uuid,uuid[]) to service_role;
revoke all on function public.current_user_agency_role() from public, anon, authenticated;
grant execute on function public.current_user_agency_role() to authenticated, service_role;
revoke all on function public.disconnect_google_sheets(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_google_sheets(uuid) to authenticated, service_role;
revoke all on function public.disconnect_oauth_integration(uuid,text) from public, anon, authenticated;
grant execute on function public.disconnect_oauth_integration(uuid,text) to authenticated, service_role;
revoke all on function public.disconnect_openrouter_integration(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_openrouter_integration(uuid) to authenticated, service_role;
revoke all on function public.disconnect_whatsapp_integration(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_whatsapp_integration(uuid) to authenticated, service_role;
revoke all on function public.get_my_sessions() from public, anon, authenticated;
grant execute on function public.get_my_sessions() to authenticated, service_role;
revoke all on function public.get_oauth_credentials(uuid,text) from public, anon, authenticated;
grant execute on function public.get_oauth_credentials(uuid,text) to service_role;
revoke all on function public.get_openrouter_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_openrouter_credentials(uuid) to service_role;
revoke all on function public.get_portal_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_portal_credentials(uuid) to service_role;
revoke all on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;
revoke all on function public.get_whatsapp_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_whatsapp_credentials(uuid) to service_role;
revoke all on function public.get_whatsapp_web_session_key(uuid) from public, anon, authenticated;
grant execute on function public.get_whatsapp_web_session_key(uuid) to service_role;
revoke all on function public.match_agent_knowledge_chunks(uuid,vector,integer) from public, anon, authenticated;
grant execute on function public.match_agent_knowledge_chunks(uuid,vector,integer) to service_role;
revoke all on function public.merge_contacts(uuid,uuid) from public, anon, authenticated;
grant execute on function public.merge_contacts(uuid,uuid) to authenticated, service_role;
revoke all on function public.notifications_check_meeting_reminders() from public, anon, authenticated;
grant execute on function public.notifications_check_meeting_reminders() to service_role;
revoke all on function public.notifications_check_meeting_started() from public, anon, authenticated;
grant execute on function public.notifications_check_meeting_started() to service_role;
revoke all on function public.notifications_check_stale_leads() from public, anon, authenticated;
grant execute on function public.notifications_check_stale_leads() to service_role;
revoke all on function public.notifications_check_unanswered_conversations() from public, anon, authenticated;
grant execute on function public.notifications_check_unanswered_conversations() to service_role;
revoke all on function public.provision_whatsapp_web_session(uuid,uuid) from public, anon, authenticated;
grant execute on function public.provision_whatsapp_web_session(uuid,uuid) to authenticated, service_role;
revoke all on function public.push_conversation_buffer_message(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.push_conversation_buffer_message(uuid,uuid,uuid,integer) to service_role;
revoke all on function public.store_google_account_grant(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.store_google_account_grant(uuid,text,text,jsonb) to service_role;
revoke all on function public.touch_last_active(uuid) from public, anon, authenticated;
grant execute on function public.touch_last_active(uuid) to authenticated, service_role;
revoke all on function public.transfer_workspace_ownership(uuid,uuid) from public, anon, authenticated;
grant execute on function public.transfer_workspace_ownership(uuid,uuid) to authenticated, service_role;
revoke all on function public.upsert_oauth_credentials(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.upsert_oauth_credentials(uuid,text,text,text) to authenticated, service_role;
revoke all on function public.upsert_openrouter_integration(uuid,text,text) from public, anon, authenticated;
grant execute on function public.upsert_openrouter_integration(uuid,text,text) to authenticated, service_role;
revoke all on function public.upsert_portal_credentials(uuid,text) from public, anon, authenticated;
grant execute on function public.upsert_portal_credentials(uuid,text) to authenticated, service_role;
revoke all on function public.upsert_whatsapp_integration(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.upsert_whatsapp_integration(uuid,text,text,text) to authenticated, service_role;
revoke all on function public.workspace_has_platform_admin_member(uuid) from public, anon, authenticated;
grant execute on function public.workspace_has_platform_admin_member(uuid) to authenticated, service_role;
revoke all on function public.workspace_member_names(uuid) from public, anon, authenticated;
grant execute on function public.workspace_member_names(uuid) to authenticated, service_role;

-- classroom_user_names: exige sesión y sólo devuelve nombres de autores de contenido de
-- classroom (comentarios o cursos). Sin email; sin nombre devuelve 'Usuario'. Classroom es global (sin workspace), así que
-- la membresía se resuelve por autoría, no por workspace compartido.
create or replace function public.classroom_user_names(user_ids uuid[])
returns table (user_id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path to ''
as $$
  select
    u.id as user_id,
    coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), 'Usuario') as full_name,
    u.raw_user_meta_data ->> 'avatar_url' as avatar_url
  from auth.users u
  where u.id = any(user_ids)
    and auth.uid() is not null
    and (
      exists (select 1 from public.classroom_comments c where c.user_id = u.id)
      or exists (select 1 from public.classroom_courses k where k.created_by = u.id)
    );
$$;

-- Privilegios por defecto para funciones que se creen en adelante por las migraciones
-- (postgres, schema public): ya no quedan ejecutables por anon ni PUBLIC. Authenticated y
-- service_role conservan EXECUTE; una función que deba ser pública debe concederse explícitamente.
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;
