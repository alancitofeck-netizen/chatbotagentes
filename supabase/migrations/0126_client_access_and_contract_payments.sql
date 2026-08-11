-- Pestañas Accesos y Contrato del módulo Clientes.
--
-- client_access: metadata liviana de qué plataformas/cuentas usa un
-- cliente (plataforma, usuario/cuenta, permiso, vencimiento) — SIN
-- credenciales/contraseñas. El placeholder anterior de accesos/page.tsx
-- hablaba de credenciales cifradas vía Supabase Vault, pero eso es un
-- proyecto aparte (cifrado + flujo de revelado + auditoría); esta tabla es
-- deliberadamente solo metadata visible, igual que la referencia visual
-- que pidió el usuario (sin campo de password en ningún lado).
create table public.client_access (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  platform text not null,
  account_label text not null,
  permission text,
  expires_at date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_access_client_idx on public.client_access (workspace_id, client_id);

alter table public.client_access enable row level security;

create policy client_access_select on public.client_access
  for select using (core.is_workspace_member(workspace_id));
create policy client_access_write on public.client_access
  for all using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- client_contract_payments: calca policy_payments (0097_policy_payments.sql)
-- — mismo problema (cronograma de pagos itemizado), ahora para contratos de
-- Cliente en vez de pólizas — más document_id para el "comprobante" que la
-- referencia visual pide y policy_payments no tiene.
create table public.client_contract_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contract_id uuid not null references public.client_contracts (id) on delete cascade,
  due_date date not null,
  amount numeric not null,
  currency text not null default 'USD',
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado')),
  paid_at timestamptz,
  payment_method text,
  document_id uuid references public.documents (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_contract_payments_contract_idx on public.client_contract_payments (contract_id, status);

alter table public.client_contract_payments enable row level security;

create policy client_contract_payments_select on public.client_contract_payments
  for select using (core.is_workspace_member(workspace_id));
create policy client_contract_payments_write on public.client_contract_payments
  for all using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- notes solo tenía policies de insert/select/delete (0002_crm_and_dashboard.sql)
-- — nunca update, porque hasta ahora ningún módulo ofrecía "editar nota" en
-- la UI (solo agregar/borrar). La pestaña Contrato de Clientes sí lo pide.
create policy notes_update on public.notes
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
