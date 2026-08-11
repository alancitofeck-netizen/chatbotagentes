-- Módulo "Clientes" (Client Control Center) — panel interno para que el
-- propio equipo de GrowthLink administre a sus clientes pagos (asesores
-- financieros que contratan generación de leads por LinkedIn + uso del
-- CRM). No confundir con `contacts`/Prospectos (los leads que ESOS
-- clientes reciben) ni con `advisors` (asesores prospectados por
-- GrowthLink antes de convertirse en clientes).
--
-- `clients` extiende `contacts`, no lo duplica: `contact_id` es el ancla
-- de identidad (nombre/email/teléfono/empresa/avatar se leen siempre de
-- `contacts`, nunca se copian acá) — mismo espíritu que
-- convertMiniAppLeadToContact/moveMiniAppLeadToPipeline ya usan en este
-- proyecto (promover hacia una entidad core existente, no copiar sus
-- datos). Solo se guardan acá los campos propios de agencia.
--
-- Fase 1 de este módulo restringe TODO (dashboard, perfil, financieros)
-- a owner/admin únicamente — a diferencia de todos los demás módulos
-- (owner/admin/agent en escritura). Setter/Account Manager/Traffic
-- Manager con visibilidad recortada queda diferido a una fase futura, sin
-- tocar el enum de roles actual (workspace_members.role).

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null unique references public.contacts (id) on delete restrict,

  profession text,
  insurer text,
  country text,
  city text,
  service_type text not null default 'linkedin_leadgen'
    check (service_type in ('linkedin_leadgen', 'crm', 'ambos', 'otro')),
  status text not null default 'en_onboarding'
    check (status in ('en_onboarding', 'activo', 'pausado', 'archivado')),

  setter_id uuid references public.workspace_members (id) on delete set null,
  account_manager_id uuid references public.workspace_members (id) on delete set null,
  traffic_manager_id uuid references public.workspace_members (id) on delete set null,

  linkedin_profile_url text,
  linkedin_sales_navigator_url text,
  calendly_url text,

  -- Cache del Client Health Score (0-100), interno, nunca expuesto a
  -- ningún cliente (no existe portal de cliente hoy). Recalculado nightly
  -- + de forma perezosa si queda desactualizado >24h (ver health.ts).
  health_score int check (health_score between 0 and 100),
  health_score_label text check (health_score_label in ('green', 'yellow', 'red')),
  health_score_updated_at timestamptz,

  config jsonb not null default '{}',

  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_workspace_status_idx on public.clients (workspace_id, status);
create index clients_setter_idx on public.clients (workspace_id, setter_id);
create index clients_account_manager_idx on public.clients (workspace_id, account_manager_id);

-- Una renovación de contrato crea una FILA NUEVA acá en vez de mutar
-- fechas — preserva historial para la pestaña Contrato, y el KPI de
-- MRR/facturación activa se calcula sumando en vivo las filas 'activo'
-- (mismo criterio que sales_goals: agregados en vivo, no rollups
-- guardados), no una sola fila que se pisa en cada renovación.
create table public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  status text not null default 'activo'
    check (status in ('borrador', 'activo', 'vencido', 'renovado', 'cancelado')),
  start_date date not null,
  end_date date not null,
  duration_months int,
  total_value numeric,
  monthly_value numeric,
  amount_paid numeric not null default 0,
  currency text not null default 'USD',
  commission_model text,
  document_id uuid references public.documents (id) on delete set null,
  notes text,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_contracts_client_idx on public.client_contracts (client_id, status);
-- Índice parcial: el KPI/alerta de "contratos por vencer" solo escanea
-- filas activas.
create index client_contracts_active_end_date_idx
  on public.client_contracts (workspace_id, end_date) where status = 'activo';

alter table public.clients enable row level security;
alter table public.client_contracts enable row level security;

create policy clients_select on public.clients
  for select using (core.is_workspace_member(workspace_id));
create policy clients_write on public.clients
  for all using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy client_contracts_select on public.client_contracts
  for select using (core.is_workspace_member(workspace_id));
create policy client_contracts_write on public.client_contracts
  for all using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in (
    'crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies',
    'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals',
    'ai_assistant', 'insurance_providers', 'data_transfer', 'asesorias', 'clientes'
  ));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'clientes', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'clientes'
)
on conflict (workspace_id, module_key) do update set enabled = true;
