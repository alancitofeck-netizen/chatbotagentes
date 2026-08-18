-- Las cuentas con rol "agent" de la agencia ya pueden conectar/gestionar la
-- hoja de Google Sheets de Agenda de un asesor a nivel código
-- (requireAgencyWorkspaceAccessForAgent, src/lib/advisorSync/actions.ts) --
-- pedido explícito del usuario. Pero la escritura real pasa por el cliente
-- de sesión normal (nunca service-role), así que la RLS de
-- advisor_sheet_connections (0145_unify_advisor_sheet_sync.sql, solo
-- owner/admin) seguía rechazando el insert/update/delete para un agent
-- real. Se amplía acá para que ambas capas queden consistentes.
drop policy if exists "advisor_sheet_connections_insert" on public.advisor_sheet_connections;
create policy "advisor_sheet_connections_insert" on public.advisor_sheet_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "advisor_sheet_connections_update" on public.advisor_sheet_connections;
create policy "advisor_sheet_connections_update" on public.advisor_sheet_connections
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

drop policy if exists "advisor_sheet_connections_delete" on public.advisor_sheet_connections;
create policy "advisor_sheet_connections_delete" on public.advisor_sheet_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
