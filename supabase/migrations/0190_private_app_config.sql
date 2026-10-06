-- Configuración por entorno para los jobs de pg_cron (ver docs/mobile/cron-en-branches.md, opción C bis).
--
-- Las migraciones de cron programan sus jobs sólo si existe la fila
-- ('environment', 'production') en private.app_config. Un branch (base nueva,
-- sin esa fila) no programa ningún job, aunque alguien cargue el Vault.
--
-- El esquema private no está expuesto por la API (PostgREST sólo expone public y
-- graphql_public) y no tiene grants para anon ni authenticated. La tabla no
-- tiene RLS policies: sólo postgres/service_role la leen.
--
-- Esta migración NO inserta la fila de producción: esa fila la carga un operador a
-- mano en el SQL editor de producción. Idempotente: en producción no cambia nada
-- si ya existe.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

revoke all on table private.app_config from public, anon, authenticated;
alter table private.app_config enable row level security;
