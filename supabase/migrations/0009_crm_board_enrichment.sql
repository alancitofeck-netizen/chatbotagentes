-- Enriched CRM Kanban board (rich cards, KPI header, bulk actions, CSV import/export).
-- Not specified in the Blueprint — a UI/UX + functionality upgrade requested directly.
--
-- `priority`/`probability` don't exist anywhere on `opportunities` today
-- (docs/blueprint/02-database.md) — additive, nullable/defaulted columns,
-- same justification pattern as `contacts.company` and the Agentes columns
-- on `workspace_members`. No RLS changes: the existing `opportunities_insert`/
-- `opportunities_update` policies (owner/admin/agent) already cover any column
-- on the row, not just the ones that existed when the policy was written.
--
-- "Cargo" (job title) and other enrichment fields deliberately do NOT get a
-- migration — they're stored in the already-existing `contacts.custom_fields`
-- jsonb, which the Blueprint designed for exactly this (arbitrary attributes
-- that don't need to be first-class columns).

alter table public.opportunities
  add column if not exists priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  add column if not exists probability numeric check (probability is null or (probability >= 0 and probability <= 100));
