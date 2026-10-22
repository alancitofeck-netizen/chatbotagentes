-- Unificación de Finanzas (PR #32 queda como versión oficial).
--
-- En main se había mergeado en paralelo otra implementación (0200_finanzas_movimientos) que:
--  · guardaba los movimientos en finanzas_movimientos — ya había datos cargados;
--  · borró collection_automation_rules / collection_automation_log (recordatorios automáticos de
--    cobro de pólizas, 0100). El código del motor vuelve con esta versión
--    (api/cron/collection-automations, collections/automationRules.ts) y el job de pg_cron
--    'collection-automations-check' nunca se desprogramó, así que solo faltan las tablas.
--
-- 1. Se recrean las tablas de automatizaciones tal cual 0100. Las reglas personalizadas que había
--    se perdieron con el drop; cada cuenta vuelve a tener las 5 reglas por defecto al abrir
--    "Recordatorios automáticos" (ensureCollectionAutomationRules). El log vacío no dispara
--    recordatorios atrasados: el motor solo evalúa due_date = hoy + trigger_days.
-- 2. Se copian los movimientos de finanzas_movimientos a finance_entries conservando el id
--    (on conflict do nothing → se puede volver a correr para tomar lo cargado hasta el deploy).
--    finanzas_movimientos no se borra todavía: queda como respaldo.

create table if not exists public.collection_automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  trigger_days int not null,
  enabled boolean not null default true,
  create_task boolean not null default false,
  notify_owner boolean not null default false,
  suggest_whatsapp boolean not null default false,
  send_email boolean not null default false,
  move_to_status text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collection_automation_rules_workspace_idx on public.collection_automation_rules (workspace_id, enabled);

create table if not exists public.collection_automation_log (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.policy_payments (id) on delete cascade,
  rule_id uuid not null references public.collection_automation_rules (id) on delete cascade,
  payment_due_date date not null,
  fired_at timestamptz not null default now(),
  unique (payment_id, rule_id, payment_due_date)
);

create index if not exists collection_automation_log_payment_idx on public.collection_automation_log (payment_id);

alter table public.collection_automation_rules enable row level security;
alter table public.collection_automation_log enable row level security;

drop policy if exists collection_automation_rules_select on public.collection_automation_rules;
drop policy if exists collection_automation_rules_insert on public.collection_automation_rules;
drop policy if exists collection_automation_rules_update on public.collection_automation_rules;
drop policy if exists collection_automation_rules_delete on public.collection_automation_rules;
drop policy if exists collection_automation_log_select on public.collection_automation_log;

create policy collection_automation_rules_select on public.collection_automation_rules
  for select using (core.is_workspace_member(workspace_id));
create policy collection_automation_rules_insert on public.collection_automation_rules
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy collection_automation_rules_update on public.collection_automation_rules
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy collection_automation_rules_delete on public.collection_automation_rules
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy collection_automation_log_select on public.collection_automation_log
  for select using (
    exists (
      select 1 from public.policy_payments pp
      join public.policies p on p.id = pp.policy_id
      where pp.id = payment_id and core.is_workspace_member(p.workspace_id)
    )
  );

insert into public.finance_entries (
  id, workspace_id, type, category, title, party, amount, currency, due_date, recurrence,
  payment_method, method_detail, paid, paid_date, notes, created_by, created_at, updated_at
)
select
  m.id, m.workspace_id, m.tipo, m.categoria, m.descripcion, m.contraparte, m.monto, m.moneda,
  m.fecha_vencimiento, nullif(m.recurrencia, 'ninguna'), m.medio_pago, m.detalle_medio,
  m.estado = 'pagado', m.fecha_pago, m.notas, m.created_by, m.created_at, m.updated_at
from public.finanzas_movimientos m
on conflict (id) do nothing;
