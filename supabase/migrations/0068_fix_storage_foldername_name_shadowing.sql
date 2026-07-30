-- Fixes a real bug found live while testing group cover uploads: the
-- insert/update/delete policies on storage.objects for `task-group-covers`
-- (0067) wrote `storage.foldername(name)` inside a correlated
-- `exists (select ... from task_groups tg where ...)` subquery. task_groups
-- has its OWN `name` column (the group's display name) — Postgres resolves
-- the unqualified `name` inside that subquery's scope to `tg.name`, not
-- `storage.objects.name` (the actual file path), a classic SQL scoping
-- shadow. Since a display name never contains "/", `storage.foldername()`
-- on it never yields a folder segment, so the `tg.id::text = ...`
-- comparison was always false — every insert/update/delete on this bucket
-- has been silently rejected by RLS since launch.
--
-- Rather than just qualifying the column (tried first, still failed live —
-- the cross-table EXISTS join has some other unresolved issue under RLS),
-- switch to the same proven pattern already working in production for the
-- `documents` bucket (0019_documents_module.sql): encode workspace_id as
-- the FIRST path segment and check has_workspace_role directly against it,
-- no join to another table at all. Path convention becomes
-- {workspaceId}/{groupId}/cover.{ext} (was {groupId}/cover.{ext}).

drop policy if exists "task_group_covers_storage_insert" on storage.objects;
create policy "task_group_covers_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'task-group-covers'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

drop policy if exists "task_group_covers_storage_update" on storage.objects;
create policy "task_group_covers_storage_update" on storage.objects
  for update using (
    bucket_id = 'task-group-covers'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

drop policy if exists "task_group_covers_storage_delete" on storage.objects;
create policy "task_group_covers_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'task-group-covers'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

-- Note: the identical bug (storage.foldername(name) shadowed by mini_apps'
-- own `name` column) also exists in `mini_app_logos_storage_insert/update/
-- delete` (0062_mini_apps_public_pages.sql) — left untouched here since
-- fixing it the same way would also require changing the mini-app logo
-- upload path convention/component (a different module), flagged
-- separately rather than changed silently in this migration.
