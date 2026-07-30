-- NOTE (superseded hypothesis, kept for the record): this was originally
-- written believing missing schema USAGE on `core` explained the "new row
-- violates row-level security policy" error on Storage uploads. Live testing
-- (see 0070_task_group_covers_final.sql) proved that wrong — the real cause
-- was Storage authenticating every request as Postgres role `anon` (a
-- project-level JWT-signing-key issue, unrelated to schema grants; confirmed
-- via a policy that checked `current_user = 'anon'`, which passed). Storage
-- functions like `has_workspace_role` were never actually blocked by a
-- schema-usage gate — pg_policies' with_check expressions are pre-parsed at
-- CREATE POLICY time and only re-check per-function EXECUTE at runtime, not
-- schema USAGE.
--
-- The grant below is harmless and left in place purely as hygiene (it
-- matches how `public` is already configured for these roles), not because
-- it fixes anything.

grant usage on schema core to anon, authenticated, service_role, supabase_storage_admin;
