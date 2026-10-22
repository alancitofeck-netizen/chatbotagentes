-- Módulo Finanzas (reemplaza a Cobranza en el menú, mismo module_key "collections").
-- Pedido: gastos (herramientas, cursos, otros) con medio de pago, cobros (pólizas, asesorías,
-- ventas), calendario y resumen mensual, por cuenta.
--
-- Justificación contra 02-database.md: los cobros de pólizas siguen viviendo en policy_payments
-- (0097/0100) — Finanzas los lee y los actualiza con las mismas acciones de siempre, no se
-- duplican. Lo que no existía en ningún lado son los movimientos que NO salen de una póliza:
-- gastos del negocio y cobros de asesorías/ventas. policy_payments exige policy_id (not null), así
-- que no sirve para eso; de ahí finance_entries. finance_settings guarda la moneda de los totales y
-- el tipo de cambio de cada cuenta (las cuentas mezclan MXN, USD y ARS).

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  category text not null check (category in ('poliza', 'asesoria', 'venta', 'herramienta', 'curso', 'gasto')),
  title text not null check (length(trim(title)) > 0),
  party text,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  due_date date not null,
  recurrence text check (recurrence in ('mensual', 'anual')),
  payment_method text,
  method_detail text,
  paid boolean not null default false,
  paid_date date,
  notes text,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_entries_workspace_due_idx on public.finance_entries (workspace_id, due_date);

alter table public.finance_entries enable row level security;

create policy "finance_entries_select" on public.finance_entries
  for select using (core.is_workspace_member(workspace_id));
create policy "finance_entries_insert" on public.finance_entries
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "finance_entries_update" on public.finance_entries
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "finance_entries_delete" on public.finance_entries
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create table public.finance_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  base_currency text not null default 'MXN',
  rates jsonb not null default '{"USD": 1, "MXN": 18.5, "ARS": 1200}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_settings enable row level security;

create policy "finance_settings_select" on public.finance_settings
  for select using (core.is_workspace_member(workspace_id));
create policy "finance_settings_insert" on public.finance_settings
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "finance_settings_update" on public.finance_settings
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
