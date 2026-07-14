-- Closes gaps found while making the CRM Tablero fully production-ready
-- (not in the Blueprint — additive, same justification pattern as
-- 0009_crm_board_enrichment.sql's priority/probability columns).

-- "Fecha de cierre estimada" — didn't exist anywhere on opportunities.
alter table public.opportunities
  add column if not exists expected_close_date date;

-- `pipelines` never had a delete policy (only select/insert/update) — needed
-- now that a client-facing "gestionar pipeline" screen can delete a pipeline
-- (the app layer blocks deleting one that still has opportunities on it).
drop policy if exists "pipelines_delete" on public.pipelines;
create policy "pipelines_delete" on public.pipelines
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
