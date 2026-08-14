-- Sistema de Agendas — un setter puede trabajar para varios asesores.
-- Tabla nueva en vez de reutilizar clients.setter_id (ese es 1:1, "setter
-- principal" del contrato — un concepto distinto). Mismo patrón RLS fase-1
-- que clients (0124_clients_module_core.sql): select=miembro,
-- insert/update/delete=owner/admin únicamente.
create table public.advisor_setter_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  setter_id uuid not null references public.workspace_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, setter_id)
);

create index advisor_setter_assignments_workspace_idx on public.advisor_setter_assignments (workspace_id);
create index advisor_setter_assignments_setter_idx on public.advisor_setter_assignments (setter_id);

alter table public.advisor_setter_assignments enable row level security;

create policy advisor_setter_assignments_select on public.advisor_setter_assignments
  for select using (core.is_workspace_member(workspace_id));
create policy advisor_setter_assignments_write on public.advisor_setter_assignments
  for all using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Texto exacto esperado en la columna "Asesor" de la hoja del setter, para
-- no depender solo de coincidencia difusa de nombre (pedido explícito del
-- usuario). Nulo = se resuelve por nombre normalizado contra
-- getRealAdvisorWorkspaces() en el momento del sync.
alter table public.clients add column if not exists sheet_alias text;
