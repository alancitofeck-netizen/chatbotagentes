-- Fase 4 del sistema "Agentes IA + WhatsApp para Referidos" — extiende el
-- motor de Agentes IA ya existente (ai_agents/ai_prompts/agent_tools,
-- 0024_ai_agents_core.sql) con un tercer module_key='referrals', en vez de
-- crear un sistema paralelo. La whitelist de autorización
-- (asesoria_referrals, ver src/lib/messaging/referralAuthorization.ts,
-- Fase 2/3) NO se toca acá — sigue siendo la única fuente de verdad de
-- "referido autorizado".

-- 1. ai_agents: tercer module_key + asesor asignado (mismo patrón que
-- asesoria_referrals.advisor_id) — nullable: un agente sin advisor_id
-- atiende TODOS los referidos del workspace, uno con advisor_id solo los
-- de ese asesor (decisionEngine.ts desambigua por esto si hay más de uno
-- activo para el mismo workspace+módulo+canal).
alter table public.ai_agents drop constraint if exists ai_agents_module_key_check;
alter table public.ai_agents add constraint ai_agents_module_key_check
  check (module_key in ('crm', 'ats', 'referrals'));
alter table public.ai_agents add column if not exists advisor_id uuid references public.workspace_members (id) on delete set null;

-- 2. workspace_modules: 'referrals' como módulo válido — decisionEngine.ts
-- ya chequea workspace_modules.enabled antes de resolver el agente, así que
-- sin esto ningún workspace podría usar un agente de referidos aunque lo
-- creara. Se habilita por defecto en todos los workspaces existentes,
-- mismo criterio aditivo que 0100/0102/0104/etc.
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in (
    'crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies',
    'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals',
    'ai_assistant', 'insurance_providers', 'data_transfer', 'asesorias', 'asesores', 'agenda',
    'operaciones', 'referrals'
  ));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'referrals', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'referrals'
);

-- 3. conversations.mode: 4º valor, aditivo — 'human'/'ai'/'hybrid' siguen
-- intactos. 'paused' = "nadie está atendiendo activamente, seguimientos
-- cancelados" (distinto de 'human' = "el asesor está atendiendo ahora").
-- decisionEngine.ts ya lo trata igual que 'human' (el agente nunca se
-- invoca) — no hace falta ningún otro cambio de motor para esto.
alter table public.conversations drop constraint if exists conversations_mode_check;
alter table public.conversations add constraint conversations_mode_check
  check (mode in ('human', 'ai', 'hybrid', 'paused'));

-- 4. Estructura de seguimientos (punto 7 del pedido) — un row por intento
-- programado para un referido/conversación puntual. El disparo automático
-- real (el cron que efectivamente los manda) queda para la siguiente
-- pasada — acá solo la estructura + el tool que programa filas (ver
-- src/lib/ai/tools/scheduleFollowup.ts) + la cancelación cuando el
-- prospecto responde o el asesor toma/pausa la conversación (ver
-- src/lib/messaging/ingest.ts y src/lib/inbox/actions.ts).
create table public.referral_followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  referral_id uuid not null references public.asesoria_referrals (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  agent_id uuid references public.ai_agents (id) on delete set null,
  attempt_number int not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  cancelled_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referral_followups_pending_idx on public.referral_followups (workspace_id, status, scheduled_at) where status = 'pending';
create index referral_followups_referral_idx on public.referral_followups (referral_id);
create index referral_followups_conversation_idx on public.referral_followups (conversation_id) where status = 'pending';

alter table public.referral_followups enable row level security;

create policy referral_followups_select on public.referral_followups
  for select using (core.is_workspace_member(workspace_id));
create policy referral_followups_insert on public.referral_followups
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy referral_followups_update on public.referral_followups
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy referral_followups_delete on public.referral_followups
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- 5. Catálogo de tools nuevos — mismo patrón exacto que
-- 0022_agent_engine_tool_schemas.sql sembrando 'request_human_handoff'.
insert into public.tools (key, name, description, handler_key, json_schema) values
  (
    'update_referral',
    'Actualizar estado del referido',
    'Actualiza el estado del referido de esta conversación (nuevo/contactado/interesado/no_interesado/convertido).',
    'update_referral',
    '{
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": ["nuevo", "contactado", "interesado", "no_interesado", "convertido"],
          "description": "Nuevo estado del referido."
        }
      },
      "required": ["status"]
    }'::jsonb
  ),
  (
    'schedule_followup',
    'Programar seguimiento',
    'Programa un seguimiento automático dentro de N días si el prospecto no responde (máximo 3 intentos por referido).',
    'schedule_followup',
    '{
      "type": "object",
      "properties": {
        "days_from_now": {"type": "integer", "description": "En cuántos días reintentar contactar, por defecto 1."}
      }
    }'::jsonb
  )
on conflict (key) do nothing;
