-- Módulo "Automatizaciones" — catálogo fijo de automatizaciones simples
-- (prender/apagar, no un constructor tipo Zapier). Cada workspace tiene sus
-- propias filas (nunca compartidas), sembradas perezosamente en el primer
-- uso real (mismo patrón que ensurePolicyPipeline/ensurePolicyAutomationRules)
-- desde el catálogo fijo en src/lib/automations/constants.ts — agregar una
-- automatización nueva a futuro es sumarla a ese catálogo, no tocar esta
-- tabla ni el resto del código (se sincroniza sola al próximo load de
-- cualquier workspace vía ensureAutomationTemplates).
create table public.automation_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null,
  name text not null,
  description text not null,
  enabled boolean not null default true,
  whatsapp_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  message_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, type)
);

create index automation_templates_workspace_idx on public.automation_templates (workspace_id);

-- Cumpleaños necesita un dato que hoy no existe en ningún lado de la base —
-- se agrega ahora aunque el disparador real de Cumpleaños todavía no esté
-- conectado (queda "guardado, sin disparador" hasta que se cargue este dato
-- para los contactos existentes).
alter table public.contacts add column if not exists birth_date date;

-- Dedupe genérico para el cron de Automatizaciones — una fila por
-- (workspace, tipo de automatización, entidad disparadora, día en que se
-- disparó). Sirve para los 3 tipos con disparador real (aniversario de
-- póliza, recordatorio de cobranza, bienvenida) sin necesitar una tabla de
-- log nueva por cada tipo que se agregue a futuro.
create table public.automation_send_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  automation_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  fired_for_date date not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, automation_type, entity_id, fired_for_date)
);

create index automation_send_log_workspace_idx on public.automation_send_log (workspace_id, automation_type);

alter table public.automation_templates enable row level security;
alter table public.automation_send_log enable row level security;

create policy automation_templates_select on public.automation_templates
  for select using (core.is_workspace_member(workspace_id));
create policy automation_templates_insert on public.automation_templates
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy automation_templates_update on public.automation_templates
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

-- automation_send_log solo lo escribe el cron (service role) — los miembros
-- del workspace pueden verlo (mismo criterio que policy_automation_log:
-- útil para depurar "¿por qué no se disparó?"), nunca lo modifican directo.
create policy automation_send_log_select on public.automation_send_log
  for select using (core.is_workspace_member(workspace_id));
