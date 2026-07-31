-- "Posibles Pólizas" module: a specialized, CRM-adjacent table for people who
-- completed a Mini App/Calculadora/Presentación/Formulario asking for
-- insurance-quote information. Deliberately NOT a replacement for `contacts`
-- (see 0002_crm_and_dashboard.sql) — every row here always links to exactly
-- one `contacts` row (dedupe-by-phone already enforced there), the same
-- "single unified profile" principle already established for
-- "Contactos de Apps" (see queries.ts's getContactIdsForAppOrigin comment).
--
-- Fixed columns cover every field the product spec enumerated explicitly;
-- `extra_fields` is the same "fixed columns + jsonb overflow" pattern already
-- used by mini_app_leads.data/contacts.custom_fields/mini_apps.config, so a
-- future insurance product can add new questions without a new migration.
-- `age` is deliberately NOT a column — computed from date_of_birth at read
-- time (same "never persist a derived, time-mutable value" principle as
-- src/lib/classroom/video.ts's duration comment).
--
-- Notes/documents reuse the EXISTING polymorphic tables (notable_type/
-- notable_id on `notes`, related_type/related_id on `documents` — both
-- already designed for exactly this, see 0019_documents_module.sql's own
-- comment) via notable_type/related_type = 'insurance_prospect'. No new
-- tables needed for either.

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects'));

-- Same backfill pattern as 0065_mini_apps_default_enabled.sql — existing
-- workspaces get the module enabled by default rather than silently missing
-- a workspace_modules row (which the app already treats as "disabled").
insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'insurance_prospects', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'insurance_prospects'
)
on conflict (workspace_id, module_key) do update set enabled = true;

create table public.insurance_prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  mini_app_id uuid references public.mini_apps (id) on delete set null,
  mini_app_lead_id uuid references public.mini_app_leads (id) on delete set null,
  -- Denormalized so this survives the mini app being renamed/deleted later —
  -- same reasoning as mini_app_leads.origen_app.
  origen_app_nombre text,
  owner_agent_id uuid references public.workspace_members (id) on delete set null,
  status text not null default 'nuevo' check (status in (
    'nuevo', 'pendiente_contacto', 'informacion_incompleta', 'en_analisis',
    'cotizacion_enviada', 'negociacion', 'poliza_emitida', 'rechazada', 'archivada'
  )),

  -- Datos personales (snapshot at submission time, same redundancy pattern
  -- as mini_app_leads.nombre/whatsapp alongside contact_id).
  full_name text,
  date_of_birth date,
  place_of_birth text,
  sex text,
  marital_status text,

  -- Información laboral
  profession text,
  occupation text,
  employer text,
  employment_tenure_months integer,
  monthly_income numeric,

  -- Información física
  height_cm numeric,
  weight_kg numeric,
  smoker boolean,
  drinks_alcohol boolean,
  exercises boolean,

  -- Formación
  education text,
  degree text,
  specializations text,

  -- Perfil personal
  hobbies text,
  sports text,
  interests text,

  -- Datos de contacto (además de lo que ya vive en `contacts`)
  phone text,
  email text,
  city text,
  province text,
  country text,

  -- Rebalse flexible — cualquier campo futuro que un nuevo producto de
  -- seguro pida, sin necesidad de una migración nueva.
  extra_fields jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index insurance_prospects_workspace_status_idx on public.insurance_prospects (workspace_id, status);
create index insurance_prospects_workspace_contact_idx on public.insurance_prospects (workspace_id, contact_id);

alter table public.insurance_prospects enable row level security;

-- Same shape as mini_apps' own policies (0061) — any member can create/edit,
-- owner/admin can delete. The auto-creation hook (ingest.ts) always uses
-- createServiceRoleClient(), bypassing RLS entirely, same as mini_app_leads.
create policy "insurance_prospects_select" on public.insurance_prospects
  for select using (core.is_workspace_member(workspace_id));
create policy "insurance_prospects_insert" on public.insurance_prospects
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "insurance_prospects_update" on public.insurance_prospects
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "insurance_prospects_delete" on public.insurance_prospects
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
