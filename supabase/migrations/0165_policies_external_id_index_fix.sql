-- Bug encontrado probando el pipeline end-to-end: PostgREST/Postgres no
-- pueden inferir un índice ÚNICO PARCIAL para un ON CONFLICT (col1, col2)
-- plano (el que genera supabase-js .upsert(..., {onConflict})) — falla con
-- "42P10: there is no unique or exclusion constraint matching the ON
-- CONFLICT specification". No hace falta que sea parcial de todos modos:
-- Postgres ya trata cada NULL como distinto en un índice único normal
-- (mismo comportamiento documentado varias veces en este proyecto para
-- otras tablas), así que las pólizas cargadas a mano (insurance_connection_id
-- y external_id ambos NULL) nunca van a chocar entre sí igual.
drop index if exists public.policies_connection_external_id_idx;
create unique index policies_connection_external_id_idx
  on public.policies (insurance_connection_id, external_id);
