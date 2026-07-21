-- Real sheet layout turned out different from 0033_kpi_module.sql's
-- assumption: it's "un archivo por setter" (confirmed with the user), each
-- file holding a raw per-lead detail table (one row per lead, with a real
-- date + status dropdowns), not a single shared sheet with one pre-aggregated
-- row per (setter, week). So the spreadsheet link is now per-SETTER, not
-- per-workspace — kpi_sheet_connections (workspace-level) is dropped, its
-- columns move onto kpi_setters. The Google OAuth account connection itself
-- stays workspace-level and untouched (integration_connections, provider
-- 'google_sheets') — one connected account can read every setter's file as
-- long as each setter shares their sheet with it (view access), confirmed
-- as the preferred model over each setter doing their own OAuth login.
alter table public.kpi_setters
  add column if not exists spreadsheet_id text,
  add column if not exists sheet_name text,
  add column if not exists column_map jsonb not null default '{}',
  add column if not exists status text not null default 'active' check (status in ('active', 'inactive')),
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_status text not null default 'pending' check (last_sync_status in ('pending', 'ok', 'error')),
  add column if not exists last_sync_error text,
  add column if not exists row_count int not null default 0;

-- kpi_setters previously only had select + a narrow "link to member" update
-- policy (both service_role-oriented) — now an admin creates/edits a setter
-- row directly (name it, paste its sheet link) before any sync has ever run,
-- so it needs real insert/delete policies too.
drop policy if exists "kpi_setters_insert" on public.kpi_setters;
create policy "kpi_setters_insert" on public.kpi_setters
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "kpi_setters_delete" on public.kpi_setters;
create policy "kpi_setters_delete" on public.kpi_setters
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Replaces the claim RPC to reclaim over kpi_setters (one sheet per setter)
-- instead of the now-dropped kpi_sheet_connections (one sheet per
-- workspace) — same claim-then-finalize shape as before, just a different
-- target table so "hundreds of workspaces × dozens of setters" still
-- spreads across cron ticks instead of one tick serially fetching every
-- setter's sheet in a single invocation.
drop function if exists public.claim_pending_kpi_syncs(int);
create or replace function public.claim_pending_kpi_syncs(p_limit int default 20)
returns setof public.kpi_setters
language sql
security definer
set search_path = ''
as $$
  update public.kpi_setters
  set last_synced_at = now()
  where id in (
    select id from public.kpi_setters
    where status = 'active' and spreadsheet_id is not null
    order by last_synced_at asc nulls first
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_pending_kpi_syncs(int) from public;
revoke all on function public.claim_pending_kpi_syncs(int) from anon;
revoke all on function public.claim_pending_kpi_syncs(int) from authenticated;
grant execute on function public.claim_pending_kpi_syncs(int) to service_role;

drop table if exists public.kpi_sheet_connections;
