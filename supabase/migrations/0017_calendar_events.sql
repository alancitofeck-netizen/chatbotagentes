-- Turns `bookings` into the full calendar-events table the "Calendario"
-- module needs — extends the existing table (already load-bearing in
-- Dashboard KPIs, src/lib/crm/queries.ts "next meeting", and
-- src/lib/agents/queries.ts per-agent meeting counts) rather than creating a
-- parallel `calendar_events` table, so none of those existing consumers fork.
alter table public.bookings
  add column if not exists created_by uuid references public.workspace_members (id) on delete set null,
  add column if not exists description text,
  add column if not exists event_type text not null default 'meeting'
    check (event_type in ('call', 'meeting', 'follow_up', 'demo', 'task', 'other')),
  add column if not exists timezone text,
  add column if not exists location text,
  add column if not exists meeting_url text,
  add column if not exists reminder_minutes integer,
  -- Same polymorphic pattern as tasks.related_type/related_id
  -- (0002_crm_and_dashboard.sql / 0016_tasks_enrichment.sql) — 'conversation'
  -- and 'opportunity' are recognized by app code, no CHECK constraint (plain
  -- text, consistent with how tasks.related_type already works).
  add column if not exists related_type text,
  add column if not exists related_id uuid,
  -- Simple recurrence: instances are materialized individually at creation
  -- time (capped, see src/lib/calendar/actions.ts) and share this group id.
  -- No "edit the whole series" feature in this pass — each instance is its
  -- own row, editable/deletable independently.
  add column if not exists recurrence_rule text check (recurrence_rule is null or recurrence_rule in ('daily', 'weekly', 'monthly')),
  add column if not exists recurrence_group_id uuid,
  add column if not exists updated_at timestamptz not null default now();

-- An event no longer requires a contact ("O dejar sin relación" per the ask).
alter table public.bookings alter column contact_id drop not null;

alter table public.bookings drop constraint if exists bookings_provider_check;
alter table public.bookings add constraint bookings_provider_check
  check (provider in ('internal', 'highlevel', 'google', 'calendly'));

create index if not exists bookings_recurrence_group_idx on public.bookings (recurrence_group_id) where recurrence_group_id is not null;

-- Real delete (distinct from the existing soft-cancel-via-status flow) —
-- explicitly requested ("Eliminar eventos"). Owner/admin only, same
-- restriction as tasks_delete/notes_delete.
create policy "bookings_delete" on public.bookings
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
