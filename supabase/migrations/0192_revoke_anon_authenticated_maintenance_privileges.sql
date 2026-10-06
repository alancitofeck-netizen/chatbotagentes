-- Cierre de privilegios de mantenimiento que anon y authenticated no usan desde la app
-- (sección 3 de la evaluación de 2026-10-05, seguimiento de 0191).
-- TRUNCATE, REFERENCES y TRIGGER sobre las tablas de public quedaban concedidos a anon y
-- authenticated. Ni la app ni PostgREST los usan: el cliente de Supabase sólo hace
-- SELECT/INSERT/UPDATE/DELETE, filtrados por RLS. Quitarlos no cambia ningún flujo.
-- Se revoca en las tablas existentes y en las default privileges de public, para que
-- las tablas nuevas no los reciban de nuevo. Service_role y postgres no se tocan.
-- Idempotente.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
