-- Completes the per-workspace credential wiring started in
-- 0012_whatsapp_integration_vault.sql: this is the READ side, used by
-- /api/messages/send (and any future YCloud-calling server code) to resolve
-- a workspace's own YCloud API key instead of the single shared
-- `process.env.YCLOUD_API_KEY` env var.
--
-- Unlike the write-side functions (0012), this one returns the DECRYPTED
-- secret — so it must never be reachable by `anon`/`authenticated` (any
-- signed-in user could otherwise read ANY workspace's YCloud key by guessing
-- workspace_id, since a SQL function's own body has no per-row RLS). Only
-- `service_role` may execute it; app code must call it via
-- src/lib/supabase/service-role.ts's client, never the request-scoped one.
create or replace function public.get_whatsapp_credentials(p_workspace_id uuid)
returns table (external_account_id text, api_key text)
language sql
security definer
set search_path = ''
stable
as $$
  select ic.external_account_id, ds.decrypted_secret
  from public.integration_connections ic
  join vault.decrypted_secrets ds on ds.id = ic.credentials_vault_ref::uuid
  where ic.workspace_id = p_workspace_id
    and ic.provider = 'ycloud'
    and ic.status = 'active'
  limit 1;
$$;

revoke all on function public.get_whatsapp_credentials(uuid) from public;
revoke all on function public.get_whatsapp_credentials(uuid) from anon;
revoke all on function public.get_whatsapp_credentials(uuid) from authenticated;
grant execute on function public.get_whatsapp_credentials(uuid) to service_role;
