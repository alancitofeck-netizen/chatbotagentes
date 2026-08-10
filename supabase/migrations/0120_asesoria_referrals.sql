-- Referidos capturados dentro de una Asesoría (diapositiva "referralCapture"
-- del Meeting OS, session.referrals — ver meetingOsTemplate.ts) como filas
-- consultables propias, en vez de quedar enterrados en el jsonb crudo de
-- asesoria_responses (question_key='referrals'). Mismo patrón exacto que
-- 0117_asesoria_responses.sql (workspace_id + asesoria_id con cascade,
-- RLS idéntica) — nueva tabla porque no existe ningún concepto de "referido"
-- reutilizable en pipelines/bookings/CRM existente.
--
-- No guarda "referred_by" como columna propia: se resuelve por join contra
-- asesorias.contact_id/name (la asesoría ya sabe quién es el prospecto que
-- lo refirió). No guarda "source_session": hoy solo existe la etapa
-- Presentación/Cita Inicial con datos reales.
--
-- `status` es el ciclo de vida CRM propio (nuevo/contactado/interesado/
-- no_interesado/convertido) — deliberadamente DISTINTO del `status:'pending'`
-- que el archivo verbatim le pone a una fila cuando el asesor aprieta
-- "Enviar regalo" (workflow interno del Meeting OS, no tiene relación con
-- este ciclo de vida). El upsert desde /sync nunca incluye `status` en el
-- payload — así un cambio de estado hecho en la pantalla de Referidos
-- sobrevive al siguiente autoguardado de esa misma asesoría.
create table public.asesoria_referrals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  asesoria_id uuid not null references public.asesorias (id) on delete cascade,
  advisor_id uuid references public.workspace_members (id) on delete set null,
  referred_contact_id uuid references public.contacts (id) on delete set null,
  name text not null,
  phone text not null,
  status text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'interesado', 'no_interesado', 'convertido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asesoria_id, phone)
);

create index asesoria_referrals_asesoria_idx on public.asesoria_referrals (asesoria_id);
create index asesoria_referrals_workspace_idx on public.asesoria_referrals (workspace_id, created_at desc);
create index asesoria_referrals_contact_idx on public.asesoria_referrals (referred_contact_id) where referred_contact_id is not null;

alter table public.asesoria_referrals enable row level security;

create policy asesoria_referrals_select on public.asesoria_referrals
  for select using (core.is_workspace_member(workspace_id));

create policy asesoria_referrals_insert on public.asesoria_referrals
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy asesoria_referrals_update on public.asesoria_referrals
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy asesoria_referrals_delete on public.asesoria_referrals
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Backfill idempotente: los referidos que ya existen hoy en asesoria_responses
-- (guardados antes de que esta tabla existiera) aparecen de inmediato, sin
-- esperar a que se reabra esa asesoría. Quedan sin referred_contact_id hasta
-- el próximo autoguardado real de esa asesoría (ahí sí corre
-- findOrCreateContact desde sync/route.ts) — no se resuelve contacto acá
-- para no duplicar en SQL la lógica de match/creación que ya vive en la app.
insert into public.asesoria_referrals (workspace_id, asesoria_id, advisor_id, name, phone, created_at, updated_at)
select
  ar.workspace_id,
  ar.asesoria_id,
  ar.advisor_id,
  trim(elem ->> 'name'),
  regexp_replace(coalesce(elem ->> 'cc', '') || coalesce(elem ->> 'phone', ''), '\D', '', 'g') as phone,
  ar.created_at,
  ar.updated_at
from public.asesoria_responses ar
cross join lateral jsonb_array_elements(ar.answer) as elem
where ar.question_key = 'referrals'
  and trim(elem ->> 'name') <> ''
  and length(regexp_replace(coalesce(elem ->> 'cc', '') || coalesce(elem ->> 'phone', ''), '\D', '', 'g')) >= 8
on conflict (asesoria_id, phone) do nothing;
