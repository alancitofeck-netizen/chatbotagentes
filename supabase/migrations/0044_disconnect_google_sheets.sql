-- Full "Desconectar Google Sheets" — the generic disconnect_oauth_integration
-- (0043_google_login_and_agent_integrations.sql) only flips
-- integration_connections.status to 'inactive'. That's fine for a plain
-- "hide the connected badge", but this feature's explicit requirements go
-- further: actually remove the OAuth connection, invalidate the stored
-- tokens (delete the Vault secret, not just leave it orphaned), and clear
-- every setter's spreadsheet_id/sheet_name (their sheet was only readable
-- because it was shared with THIS Google account — once disconnected, the
-- link is dead weight that would otherwise show a stale "hoja vinculada"
-- with no way to actually read it). All three run inside one function so a
-- failure partway through rolls back the whole thing instead of leaving the
-- integration in a mixed state (tokens gone but kpi_setters still pointing
-- at a spreadsheet, for example).
--
-- Deliberately its own function rather than widening
-- disconnect_oauth_integration: that one is shared by google_calendar/
-- google_drive/google_account too, none of which asked for this
-- (vault-secret-deletion + dependent-data-cleanup) behavior — changing it
-- would silently change what "disconnect" means for three other
-- integrations that weren't part of this request.
--
-- owner/admin only (core.has_workspace_role(..., ['owner','admin'])) is
-- tighter than disconnect_oauth_integration's owner/admin/agent — this
-- feature's requirement is explicit that only Owner/Admin may connect or
-- disconnect Google Sheets, so the RPC itself enforces that floor, not just
-- the calling Server Action (defense in depth, consistent with why
-- upsert_oauth_credentials/disconnect_oauth_integration check roles inline
-- rather than trusting the caller).
create or replace function public.disconnect_google_sheets(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
begin
  if not core.has_workspace_role(p_workspace_id, array['owner', 'admin']) then
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

  -- Unlink every setter's sheet in THIS workspace only — never touches
  -- kpi_setters rows in any other workspace_id, and doesn't delete the
  -- setter roster itself (name/team), only the now-unreadable spreadsheet
  -- reference and its stale sync status.
  update public.kpi_setters
  set spreadsheet_id = null,
      sheet_name = null,
      status = 'inactive',
      last_sync_status = 'pending',
      last_sync_error = null
  where workspace_id = p_workspace_id;
end;
$$;

revoke all on function public.disconnect_google_sheets(uuid) from public;
revoke all on function public.disconnect_google_sheets(uuid) from anon;
grant execute on function public.disconnect_google_sheets(uuid) to authenticated;
