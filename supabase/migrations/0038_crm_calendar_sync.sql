-- CRM <-> Calendar: reuses the existing `bookings` table (already has
-- related_type/related_id supporting 'opportunity' by convention since
-- 0017_calendar_events.sql) rather than a parallel calendar_events table.
-- opportunities.calendar_event_id is the one addition needed to know which
-- specific booking is "the" auto-generated estimated-close-date placeholder
-- for a given opportunity, as opposed to any other booking a user might
-- separately relate to it (e.g. a real scheduled meeting) via
-- related_type/related_id alone — those are ambiguous 1:many, this is 1:1.
alter table public.opportunities
  add column if not exists calendar_event_id uuid references public.bookings (id) on delete set null;

-- A dedicated event_type distinguishes these system-generated placeholders
-- from real meetings/calls/etc. in the Calendar UI (own color, and lets code
-- filter "is this an auto-generated close-date marker" without parsing the
-- description text).
alter table public.bookings drop constraint if exists bookings_event_type_check;
alter table public.bookings add constraint bookings_event_type_check
  check (event_type in ('call', 'meeting', 'follow_up', 'demo', 'task', 'other', 'estimated_close'));
