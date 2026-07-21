-- tags never had an UPDATE policy (only select/insert/delete existed in
-- 0003_inbox.sql) — needed now for renameWorkspaceTag (src/lib/inbox/actions.ts),
-- part of building a real Etiquetas management screen. Same role set as
-- tags_insert (owner/admin/agent) since renaming is no more sensitive than
-- creating; deletion stays owner/admin-only via the existing tags_delete policy.

create policy "tags_update" on public.tags
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
