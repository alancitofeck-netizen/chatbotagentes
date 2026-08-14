-- Sistema de Agendas — corrección de arquitectura: la hoja de Google
-- Sheets es la única fuente de verdad; Supabase es cache/espejo interno.
-- Reemplaza el diseño de 0137-0141 (escribía en `bookings`, empujaba a
-- Google Calendar).

create table public.agenda_appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  advisor_client_id uuid not null references public.clients (id) on delete cascade,
  setter_id uuid references public.workspace_members (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  subject text,
  appointment_type text,
  estado_cita text not null default 'agendada' check (
    estado_cita in ('agendada', 'confirmada', 'realizada', 'no_show', 'cancelada', 'venta')
  ),
  source text not null default 'google_sheets_kpi' check (source in ('google_sheets_kpi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agenda_appointments_workspace_start_idx on public.agenda_appointments (workspace_id, start_time);
create index agenda_appointments_advisor_client_idx on public.agenda_appointments (advisor_client_id);
create index agenda_appointments_setter_idx on public.agenda_appointments (setter_id) where setter_id is not null;

alter table public.agenda_appointments enable row level security;

create policy agenda_appointments_select on public.agenda_appointments
  for select using (core.is_workspace_member(workspace_id));
-- Sin policy de insert/update/delete: solo el runner de sync y
-- updateEstadoCita (ambos service-role) escriben acá — mismo criterio que
-- appointment_sheet_rows.

-- Retarget appointment_sheet_rows: booking_id -> appointment_id.
alter table public.appointment_sheet_rows drop column booking_id;
alter table public.appointment_sheet_rows add column appointment_id uuid references public.agenda_appointments (id) on delete set null;

-- Fuerza un re-sync completo en la próxima corrida: el hash por fila es
-- contenido-de-la-fila, no del destino — sin este reset una fila cuyo
-- contenido no cambió se saltea y jamás obtiene appointment_id. No hay
-- datos reales sincronizados todavía, así que este reset no pierde nada.
delete from public.appointment_sheet_rows;
update public.appointment_sheet_connections set last_sheet_hash = null, last_synced_at = null;

-- bookings vuelve a ser exclusivamente de /calendar + Google Calendar.
drop index if exists public.bookings_setter_idx;
alter table public.bookings drop column if exists setter_id;
alter table public.bookings drop column if exists source;
alter table public.bookings drop column if exists estado_cita;

-- module_key nuevo: 'agenda' (mismo patrón drop/add que cada módulo
-- anterior, última definición en 0129).
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key = any (array[
    'crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies',
    'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals',
    'ai_assistant', 'insurance_providers', 'data_transfer', 'asesorias', 'asesores', 'agenda'
  ]));

-- Backfill: habilita "agenda" para TODOS los workspaces existentes.
insert into public.workspace_modules (workspace_id, module_key, enabled)
select id, 'agenda', true from public.workspaces
on conflict (workspace_id, module_key) do update set enabled = true;
