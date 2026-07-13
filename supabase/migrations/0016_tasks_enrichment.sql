-- Enriches the existing `tasks` table (0002_crm_and_dashboard.sql) so the
-- Dashboard's "Tareas pendientes" widget can become a real task manager:
-- priority, an explicit 3-state status (replacing the completed_at-only
-- signal), who created it, a free-text description, and an updated_at.
--
-- Deliberately NOT added: contact_id/conversation_id FK columns — tasks
-- already has the polymorphic related_type/related_id pair (same pattern as
-- notes.notable_type/notable_id), and related_type has no CHECK constraint
-- (plain text), so 'conversation' becomes a recognized value purely by
-- application-code convention, no constraint change needed.
--
-- No RLS changes needed — the existing tasks_insert/update policies
-- (owner/admin/agent) already cover any new column, same reasoning as
-- 0009_crm_board_enrichment.sql's priority/probability addition to opportunities.
alter table public.tasks
  add column if not exists created_by uuid references public.workspace_members (id) on delete set null,
  add column if not exists description text,
  add column if not exists priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  add column if not exists status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  add column if not exists updated_at timestamptz not null default now();

-- Backfill: any row that was already completed (completed_at set) before
-- this migration must not default to 'pending'.
update public.tasks set status = 'completed' where completed_at is not null and status = 'pending';
