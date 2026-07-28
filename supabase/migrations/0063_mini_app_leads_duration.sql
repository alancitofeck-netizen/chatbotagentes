-- Contactos de Apps — "tiempo que tardó en completar la mini app" is a
-- property every future template (quiz, calculadora, formulario) will have,
-- not just the retirement simulator — belongs at the same tier as
-- received_at/status, not buried inside the per-template `data` jsonb.
alter table public.mini_app_leads add column if not exists duration_seconds integer;
