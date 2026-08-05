-- Historial de endosos formal — distinto del Timeline genérico (audit_log):
-- un endoso es un cambio contractual con su propia fecha y tipo (cambio de
-- beneficiario, ajuste de suma asegurada, etc.), no una entrada de log de
-- auditoría de la app.

create table public.policy_endorsements (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  endorsement_date date not null,
  type text not null check (type in ('cambio_beneficiario', 'ajuste_suma_asegurada', 'cambio_direccion', 'cambio_vehiculo', 'cambio_prima', 'otro')),
  description text not null,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index policy_endorsements_policy_idx on public.policy_endorsements (policy_id, endorsement_date desc);

alter table public.policy_endorsements enable row level security;

create policy policy_endorsements_select on public.policy_endorsements
  for select using (
    exists (select 1 from public.policies p where p.id = policy_id and core.is_workspace_member(p.workspace_id))
  );
create policy policy_endorsements_insert on public.policy_endorsements
  for insert with check (
    exists (select 1 from public.policies p where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent']))
  );
create policy policy_endorsements_delete on public.policy_endorsements
  for delete using (
    exists (select 1 from public.policies p where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin']))
  );
