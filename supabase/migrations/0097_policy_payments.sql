-- Tracking de pagos/cuotas por póliza — pedido explícito ("Pagos" como tab
-- del detalle, comisiones/cobranza como concepto relacionado). Una fila por
-- cuota esperada; "generar cronograma" (actions.ts) crea N filas según
-- payment_frequency, pero el usuario también puede agregar/editar cuotas
-- sueltas a mano (ej. un pago parcial, un cargo extra).

create table public.policy_payments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  due_date date not null,
  amount numeric not null,
  currency text not null default 'USD',
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'vencido')),
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index policy_payments_policy_idx on public.policy_payments (policy_id, due_date);

alter table public.policy_payments enable row level security;

create policy policy_payments_select on public.policy_payments
  for select using (
    exists (select 1 from public.policies p where p.id = policy_id and core.is_workspace_member(p.workspace_id))
  );
create policy policy_payments_insert on public.policy_payments
  for insert with check (
    exists (select 1 from public.policies p where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent']))
  );
create policy policy_payments_update on public.policy_payments
  for update using (
    exists (select 1 from public.policies p where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent']))
  );
create policy policy_payments_delete on public.policy_payments
  for delete using (
    exists (select 1 from public.policies p where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin']))
  );
