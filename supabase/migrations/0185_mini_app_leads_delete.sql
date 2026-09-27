-- mini_app_leads had select/update policies (0061) but no delete policy at
-- all, so RLS's default-deny silently blocked any DELETE from a normal
-- (non-service-role) client. Adding it now for the "borrar lead" button in
-- LeadDetailDrawer — scoped to owner/admin only (not "agent", unlike the
-- update policy), matching mini_apps_delete's stricter posture for the
-- other genuinely irreversible action in this module (deleting the whole
-- mini app).
create policy "mini_app_leads_delete" on public.mini_app_leads
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
