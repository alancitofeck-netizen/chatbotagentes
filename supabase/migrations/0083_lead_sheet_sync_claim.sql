-- Claim atómico para el cron de sync — mismo patrón exacto que
-- claim_pending_kpi_syncs (0035_kpi_setter_sheets.sql): FOR UPDATE SKIP
-- LOCKED evita que dos corridas superpuestas procesen la misma conexión dos
-- veces. search_path = '' (no 'public') + todo fully-qualified es el
-- convenio más estricto ya usado en esa misma migración más reciente.
create or replace function public.claim_pending_lead_sheet_syncs(p_limit int default 20)
returns setof public.lead_sheet_connections
language sql
security definer
set search_path = ''
as $$
  update public.lead_sheet_connections
  set last_synced_at = now()
  where id in (
    select id from public.lead_sheet_connections
    where status = 'active'
    order by last_synced_at asc nulls first
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_lead_sheet_syncs(int) from public;
revoke all on function public.claim_pending_lead_sheet_syncs(int) from anon;
revoke all on function public.claim_pending_lead_sheet_syncs(int) from authenticated;
grant execute on function public.claim_pending_lead_sheet_syncs(int) to service_role;
