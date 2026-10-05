-- Grants de los roles de la API (anon, authenticated, service_role) sobre el
-- esquema public. En producción ya existen (los pone la plataforma de Supabase).
-- En un branch recién creado a partir de las migraciones, las tablas quedan con
-- ACL sólo para postgres: el cliente de la app y el service role no pueden leer
-- nada, aunque RLS esté bien. Verificado en producción: las 128 tablas de public
-- tienen RLS activo, así que estos grants no abren acceso fuera de las políticas.
-- Idempotente: en producción no cambia nada.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Objetos que se creen en adelante por las migraciones (las ejecuta postgres).
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
