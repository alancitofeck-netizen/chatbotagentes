-- disconnect_google_sheets (0044_disconnect_google_sheets.sql) was scoped to
-- owner/admin only, matching that feature's original spec at the time. This
-- corrects it: each Agent administers their OWN workspace (a self-service
-- signup has no owner/admin at all — provision-workspace.ts), so they must
-- be able to connect AND disconnect Google Calendar/Sheets/Drive for their
-- own workspace, same as owner/admin, never for another workspace.
--
-- Calendar/Drive's shared disconnect_oauth_integration and the connect-side
-- upsert_oauth_credentials (both 0043_google_login_and_agent_integrations.sql)
-- already check ['owner','admin','agent'] — disconnect_google_sheets was the
-- one function still narrower than the rest of this pipeline. Widening it
-- here brings all three integrations back to one consistent rule.
--
-- A platform admin's "modo supervisor" session still can't do this: their
-- synthetic role is "agent" too, but they have no real workspace_members row
-- in the supervised workspace, so core.has_workspace_role(...) evaluates
-- false for them regardless — supervision stays read-only exactly as before,
-- unrelated to this change.
create or replace function public.disconnect_google_sheets(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin', 'agent']) then
    raise exception 'not authorized to manage the Google Sheets integration for this workspace';
  end if;

  select credentials_vault_ref into v_secret_id
  from public.integration_connections
  where workspace_id = p_workspace_id and provider = 'google_sheets';

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  delete from public.integration_connections
  where workspace_id = p_workspace_id and provider = 'google_sheets';

  update public.kpi_setters
  set spreadsheet_id = null,
      sheet_name = null,
      status = 'inactive',
      last_sync_status = 'pending',
      last_sync_error = null
  where workspace_id = p_workspace_id;
end;
$$;
