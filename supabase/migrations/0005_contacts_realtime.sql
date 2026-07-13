-- Adds `contacts` to the Realtime publication so the new Contactos list
-- (src/app/(protected)/contacts/) can subscribe to live inserts/updates,
-- the same way 0003_inbox.sql did for conversations/messages.
alter publication supabase_realtime add table public.contacts;
