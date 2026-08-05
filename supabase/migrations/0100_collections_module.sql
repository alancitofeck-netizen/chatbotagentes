-- Módulo "Cobranza" — centro financiero sobre los MISMOS datos de
-- policy_payments (0097) en vez de una tabla paralela ("no quiero duplicar
-- información", pedido explícito). Solo agrega las columnas que le faltaban
-- para el detalle completo del cobro (recibo/emisión/referencia) y amplía
-- el estado para separar "vencido" (era un estado guardado, ahora se
-- deriva de due_date en la app) de "en_seguimiento"/"cancelado" (nuevos
-- estados reales que el asesor sí puede setear a mano).

alter table public.policy_payments add column if not exists receipt_number text;
alter table public.policy_payments add column if not exists issue_date date;
alter table public.policy_payments add column if not exists reference text;

alter table public.policy_payments drop constraint if exists policy_payments_status_check;
alter table public.policy_payments add constraint policy_payments_status_check
  check (status in ('pendiente', 'en_seguimiento', 'pagado', 'cancelado'));

-- Registra el module_key y lo habilita para los workspaces existentes —
-- mismo patrón que 0099_advisory_sessions_module.sql.
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'collections', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'collections'
)
on conflict (workspace_id, module_key) do update set enabled = true;

-- Motor de recordatorios de cobro — misma arquitectura exacta que
-- policy_automation_rules/policy_automation_log (0092), duplicada a
-- propósito en vez de forzar un esquema genérico único: "recordar antes
-- del vencimiento de una póliza" y "recordar antes del vencimiento de un
-- cobro" son conceptualmente parecidos pero apuntan a tablas padre
-- distintas (policies vs. policy_payments) — unificarlas hoy sería un
-- refactor más grande de lo que da esta fase, documentado acá para no
-- esconder la duplicación.
create table public.collection_automation_rules (
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

create index collection_automation_rules_workspace_idx on public.collection_automation_rules (workspace_id, enabled);

create table public.collection_automation_log (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.policy_payments (id) on delete cascade,
  rule_id uuid not null references public.collection_automation_rules (id) on delete cascade,
  payment_due_date date not null,
  fired_at timestamptz not null default now(),
  unique (payment_id, rule_id, payment_due_date)
);

create index collection_automation_log_payment_idx on public.collection_automation_log (payment_id);

alter table public.collection_automation_rules enable row level security;
alter table public.collection_automation_log enable row level security;

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
