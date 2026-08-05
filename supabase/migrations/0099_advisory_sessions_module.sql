-- Módulo "Asesoría Guiada": asistente interactivo de varios pasos que el
-- asesor completa en vivo durante una reunión (Perfil → Descubrimiento →
-- Ramo → Análisis IA → Resumen). Una fila por sesión, actualizada
-- progresivamente paso a paso (autosave) — no existía en el proyecto un
-- patrón de "sesión con progreso incremental" reusable (confirmado antes de
-- diseñar esto), así que es tabla nueva.
--
-- "Columnas fijas + jsonb overflow" por paso (profile_data/discovery_data/
-- branch_answers), mismo criterio que insurance_prospects.extra_fields /
-- contacts.custom_fields — cada paso tiene su propio jsonb en vez de decenas
-- de columnas sueltas, porque los campos varían mucho según el ramo elegido
-- y no hay necesidad de filtrar/ordenar por ellos individualmente.

create table public.advisory_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  owner_id uuid references public.workspace_members (id) on delete set null,
  created_by uuid references public.workspace_members (id) on delete set null,
  status text not null default 'en_progreso' check (status in ('en_progreso', 'completada', 'archivada')),
  current_step text not null default 'perfil' check (current_step in ('perfil', 'descubrimiento', 'ramo', 'analisis_ia', 'resumen')),
  profile_data jsonb not null default '{}',
  discovery_data jsonb not null default '{}',
  branch_key text check (branch_key in ('gmm', 'vida', 'autos', 'hogar', 'empresarial', 'retiro', 'ahorro', 'viaje', 'mascotas')),
  branch_answers jsonb not null default '{}',
  ai_analysis jsonb,
  summary_notes text,
  -- Vínculo opcional a la póliza creada/asociada desde el paso Resumen — no
  -- se crea automáticamente, solo se referencia si el asesor usó el botón
  -- "Crear póliza" (deep-link a Pólizas, mismo patrón que ContactInfoPanel).
  policy_id uuid references public.policies (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index advisory_sessions_workspace_idx on public.advisory_sessions (workspace_id, status, updated_at desc);
create index advisory_sessions_contact_idx on public.advisory_sessions (contact_id);

alter table public.advisory_sessions enable row level security;

-- Mismo patrón exacto que policies (0088): select para cualquier miembro,
-- insert/update para owner/admin/agent, delete solo owner/admin.
create policy advisory_sessions_select on public.advisory_sessions
  for select using (core.is_workspace_member(workspace_id));
create policy advisory_sessions_insert on public.advisory_sessions
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy advisory_sessions_update on public.advisory_sessions
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy advisory_sessions_delete on public.advisory_sessions
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Registra el module_key y lo habilita para los workspaces existentes —
-- mismo patrón que 0089_policies_module_key.sql.
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'advisory_sessions', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'advisory_sessions'
)
on conflict (workspace_id, module_key) do update set enabled = true;
