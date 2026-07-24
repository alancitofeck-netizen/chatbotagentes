-- kpis/actions.ts's createKpiSetterAction/setKpiSetterSheetAction/
-- unlinkKpiSetterSheetAction/syncKpisNowAction/setKpiGoalAction/
-- linkKpiSetterAction/removeKpiSetterAction now allow Agent at the
-- app layer (requireNotSupervising instead of requireManagerRole,
-- src/lib/auth/roles.ts) — but the underlying RLS policies on
-- kpi_setters/kpi_goals (0033_kpi_module.sql, 0035_kpi_setter_sheets.sql)
-- were still owner/admin only, so an Agent's write would reach the app
-- check, pass it, and then get silently rejected by Postgres anyway. Same
-- reasoning as every other "Agent manages their own workspace" fix this
-- session: a self-service signup has no owner/admin at all
-- (provision-workspace.ts), so KPI setter/goal management must be usable by
-- the sole Agent who owns that workspace.
drop policy if exists "kpi_setters_update_link" on public.kpi_setters;
create policy "kpi_setters_update_link" on public.kpi_setters
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "kpi_setters_insert" on public.kpi_setters;
create policy "kpi_setters_insert" on public.kpi_setters
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "kpi_setters_delete" on public.kpi_setters;
create policy "kpi_setters_delete" on public.kpi_setters
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "kpi_goals_insert" on public.kpi_goals;
create policy "kpi_goals_insert" on public.kpi_goals
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "kpi_goals_update" on public.kpi_goals;
create policy "kpi_goals_update" on public.kpi_goals
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "kpi_goals_delete" on public.kpi_goals;
create policy "kpi_goals_delete" on public.kpi_goals
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
