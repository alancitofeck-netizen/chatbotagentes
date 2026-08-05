-- Motor de recordatorios de renovación de pólizas — evaluado por umbral de
-- días (no por evento de conversación, a diferencia de `automations`/
-- `automation_executions`, que están atadas a ToolContext de una
-- conversación y no sirven para esto), mismo espíritu que los checks de
-- notifications_check_* (0079) pero con reglas configurables por workspace
-- en vez de un umbral fijo hardcodeado, porque acá sí tiene sentido que el
-- asesor elija sus propios días/acciones.

create table public.policy_automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  -- Positivo = N días ANTES del vencimiento; negativo = N días DESPUÉS
  -- (vencida hace N días) — un único campo cubre "antes" y "después" sin
  -- necesitar un enum de tipo de trigger separado.
  trigger_days int not null,
  enabled boolean not null default true,
  create_task boolean not null default false,
  notify_owner boolean not null default false,
  -- No auto-envía WhatsApp (requiere plantilla de Meta pre-aprobada fuera de
  -- la ventana de 24hs, que no podemos confirmar que exista) — en cambio
  -- crea una tarea accionable con el link wa.me ya armado, mismo patrón que
  -- el botón "Enviar por WhatsApp" de PolicyTable.tsx.
  suggest_whatsapp boolean not null default false,
  -- Email SÍ se envía de verdad (Resend, sin restricción de plantillas).
  send_email boolean not null default false,
  -- Nombre de policies.status (constants.ts) al que mover la póliza, o null
  -- para no mover etapa.
  move_to_status text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index policy_automation_rules_workspace_idx on public.policy_automation_rules (workspace_id, enabled);

-- Dedupe: una regla dada solo dispara UNA vez por (póliza, end_date) — si la
-- póliza se renueva y end_date cambia, la regla vuelve a poder dispararse
-- para la nueva fecha naturalmente, sin necesidad de resetear nada a mano.
create table public.policy_automation_log (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  rule_id uuid not null references public.policy_automation_rules (id) on delete cascade,
  policy_end_date date not null,
  fired_at timestamptz not null default now(),
  unique (policy_id, rule_id, policy_end_date)
);

create index policy_automation_log_policy_idx on public.policy_automation_log (policy_id);

alter table public.policy_automation_rules enable row level security;
alter table public.policy_automation_log enable row level security;

-- Mismo patrón que policies/policy_coverages (0088): select para cualquier
-- miembro, insert/update/delete solo owner/admin/agent.
create policy policy_automation_rules_select on public.policy_automation_rules
  for select using (core.is_workspace_member(workspace_id));
create policy policy_automation_rules_insert on public.policy_automation_rules
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy policy_automation_rules_update on public.policy_automation_rules
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy policy_automation_rules_delete on public.policy_automation_rules
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- policy_automation_log solo lo escribe el cron (service role) — los
-- miembros del workspace pueden verlo (útil para depurar "¿por qué no me
-- avisó?") vía el join a policies, pero nunca lo modifican directamente.
create policy policy_automation_log_select on public.policy_automation_log
  for select using (
    exists (select 1 from public.policies p where p.id = policy_id and core.is_workspace_member(p.workspace_id))
  );
