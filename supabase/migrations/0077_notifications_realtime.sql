-- Adds `notifications` to the Realtime publication so NotificationBell can
-- subscribe to live inserts, same pattern as 0005_contacts_realtime.sql.
alter publication supabase_realtime add table public.notifications;
