-- Importador de Cartera (Fase 1) — touches the SHARED core `contacts` table
-- (also used by CRM/ATS/Inbox), so calling this out explicitly per
-- CLAUDE.md's schema-change rule: only `dni`/`cuit` are added as real
-- columns, because they're Paso 5's primary contact-duplicate-detection
-- keys and need fast indexed exact-match lookups at 10k-row scale. Every
-- other Fase 1 client field from the request (Dirección, Ciudad, Provincia,
-- Código Postal, Fecha de nacimiento) is lower-value to query and goes into
-- the existing contacts.custom_fields jsonb under namespaced keys instead —
-- same precedent already used for job_title (src/app/(protected)/crm/
-- actions.ts) and cargo (src/lib/documents/import.ts). Nombre+Apellido
-- concatenate into the existing contacts.name; Razón social maps to the
-- existing contacts.company — no new columns needed for those either.
alter table public.contacts
  add column if not exists dni text,
  add column if not exists cuit text;

create index if not exists contacts_dni_idx on public.contacts (workspace_id, dni);
create index if not exists contacts_cuit_idx on public.contacts (workspace_id, cuit);
