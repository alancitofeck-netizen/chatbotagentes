-- Módulo "Conexión con Aseguradoras" — Centro de Integraciones. Solo 3
-- tablas nuevas, no las 9 originalmente pedidas: pólizas/comisiones/cobros
-- ya viven en policies/policy_payments (reusados, no duplicados — mismo
-- criterio "Reutilización explícita" del resto de la sesión), y los
-- eventos van a audit_log (ya existe). insurance_credentials NO se crea:
-- esta fase no guarda ninguna credencial real de portal/API de ninguna
-- aseguradora (ver la nota en insuranceProviders/constants.ts sobre por
-- qué "Portal Web"/"API" quedan como "Próximamente" — no hay acceso
-- confirmado a ningún portal/API real todavía, construir eso ahora sería
-- fabricar una integración ficticia).

-- Catálogo GLOBAL (no por workspace) — cualquier aseguradora nueva es una
-- fila, nunca código nuevo ("no hardcodear" pedido explícito). Se siembra
-- acá abajo con las 12 aseguradoras pedidas; agregar la #13 es un INSERT.
create table public.insurance_providers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  brand_color text not null,
  -- Métodos habilitados HOY: todas arrancan en {manual} — 'portal'/'api' se
  -- suman a esta lista recién cuando haya un acceso real confirmado con esa
  -- aseguradora puntual (no es una bandera global, es por aseguradora).
  available_methods text[] not null default '{manual}',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.insurance_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider_id uuid not null references public.insurance_providers (id) on delete cascade,
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'error')),
  method text check (method in ('manual', 'portal', 'api')),
  connected_by uuid references public.workspace_members (id) on delete set null,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider_id)
);

create table public.insurance_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.insurance_connections (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  triggered_by uuid references public.workspace_members (id) on delete set null,
  source_file_name text,
  policies_synced_count int not null default 0,
  clients_synced_count int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index insurance_connections_workspace_idx on public.insurance_connections (workspace_id);
create index insurance_sync_jobs_connection_idx on public.insurance_sync_jobs (connection_id, started_at desc);

-- Traza qué conexión/sync trajo cada póliza — así "cantidad de pólizas
-- sincronizadas" en la tarjeta/panel es una cuenta real, no un número
-- aparte a mantener sincronizado a mano.
alter table public.policies add column if not exists insurance_connection_id uuid references public.insurance_connections (id) on delete set null;
create index if not exists policies_insurance_connection_idx on public.policies (insurance_connection_id);

alter table public.insurance_providers enable row level security;
alter table public.insurance_connections enable row level security;
alter table public.insurance_sync_jobs enable row level security;

-- Catálogo global de solo lectura — mismo dato para cualquier workspace,
-- nada sensible (nombre/color/métodos disponibles).
create policy insurance_providers_select on public.insurance_providers
  for select using (auth.uid() is not null);

create policy insurance_connections_select on public.insurance_connections
  for select using (core.is_workspace_member(workspace_id));
create policy insurance_connections_insert on public.insurance_connections
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy insurance_connections_update on public.insurance_connections
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy insurance_connections_delete on public.insurance_connections
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy insurance_sync_jobs_select on public.insurance_sync_jobs
  for select using (core.is_workspace_member(workspace_id));
create policy insurance_sync_jobs_insert on public.insurance_sync_jobs
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy insurance_sync_jobs_update on public.insurance_sync_jobs
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals', 'ai_assistant', 'insurance_providers'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'insurance_providers', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'insurance_providers'
)
on conflict (workspace_id, module_key) do update set enabled = true;

insert into public.insurance_providers (key, name, brand_color, position) values
  ('gnp', 'GNP', '#00833E', 0),
  ('axa', 'AXA', '#00008F', 1),
  ('metlife', 'MetLife', '#00A9E0', 2),
  ('qualitas', 'Qualitas', '#E30613', 3),
  ('mapfre', 'MAPFRE', '#E4032E', 4),
  ('hdi', 'HDI', '#E2001A', 5),
  ('zurich', 'Zurich', '#0066B3', 6),
  ('seguros_atlas', 'Seguros Atlas', '#8A1538', 7),
  ('banorte', 'Banorte', '#EB0029', 8),
  ('bbva_seguros', 'BBVA Seguros', '#072146', 9),
  ('inbursa', 'Inbursa', '#7A1C2B', 10),
  ('chubb', 'Chubb', '#B01F24', 11)
on conflict (key) do nothing;
