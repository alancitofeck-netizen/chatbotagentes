-- Módulo "Asesorías" (Meeting OS) — reemplaza a "Asesoría Guiada"
-- (advisory_sessions, que queda intacta pero huérfana; no se borra data).
-- Mismo criterio "columnas fijas + jsonb overflow" que advisory_sessions/
-- mini_apps/presentations: `state` guarda el `meetingProject` completo tal
-- cual lo persiste el propio archivo (única fuente de verdad para
-- re-hidratarlo); `context_snapshot` guarda datos que el archivo no tiene
-- dónde mostrar (pipeline/etapa del contacto al momento de crear la
-- asesoría) para uso futuro (IA) — nunca se le manda al iframe.

create table public.asesorias (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  advisor_id uuid references public.workspace_members (id) on delete set null,
  created_by uuid references public.workspace_members (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  name text not null default 'Nueva asesoría',
  status text not null default 'no_iniciada' check (status in ('no_iniciada', 'en_progreso', 'finalizada')),
  current_slide int not null default 0,
  template_name text,
  state jsonb not null default '{}',
  context_snapshot jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index asesorias_workspace_idx on public.asesorias (workspace_id, status, updated_at desc);
create index asesorias_contact_idx on public.asesorias (contact_id);

alter table public.asesorias enable row level security;

create policy asesorias_select on public.asesorias
  for select using (core.is_workspace_member(workspace_id));

create policy asesorias_insert on public.asesorias
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy asesorias_update on public.asesorias
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy asesorias_delete on public.asesorias
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- registra el nuevo module_key (deja "advisory_sessions" en la lista para no
-- romper filas ya existentes de workspaces viejos, aunque nada lo use más).
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in (
    'crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies',
    'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals',
    'ai_assistant', 'insurance_providers', 'data_transfer', 'asesorias'
  ));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'asesorias', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'asesorias'
)
on conflict (workspace_id, module_key) do update set enabled = true;
