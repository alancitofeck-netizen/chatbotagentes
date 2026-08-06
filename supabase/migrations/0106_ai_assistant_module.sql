-- Módulo "Asistente IA": copiloto in-app del propio usuario (distinto del
-- motor de Agentes IA de CRM que ya existe para responderle a leads por
-- WhatsApp — docs/blueprint/13-agent-engine.md). Deliberadamente NO reusa
-- conversations/messages/tool_calls/ai_agents/ai_prompts de ese motor: esas
-- tablas están atadas al concepto "conversación con un contacto externo" y
-- a un agente CONFIGURABLE por prompt — acá hay un solo asistente fijo,
-- por miembro, sin contacto. Mismo patrón conceptual (LLM + tool-calling +
-- auditoría), estructura de datos propia y más simple.
--
-- Sin tabla `tools` propia tampoco: el catálogo de herramientas del
-- asistente es fijo (código, src/lib/assistant/tools/registry.ts), no
-- configurable por el Owner como sí lo es el de un agente de WhatsApp — una
-- tabla de catálogo agregaría indirección sin ningún beneficio real acá.

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_conversations_member_idx on public.assistant_conversations (member_id, updated_at desc);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text,
  -- Tarjetas de confirmación pendientes que quedan colgando de este mensaje
  -- del asistente (ids de assistant_tool_calls) — la UI las renderiza debajo.
  pending_tool_call_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index assistant_messages_conversation_idx on public.assistant_messages (conversation_id, created_at);

create table public.assistant_tool_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  conversation_id uuid references public.assistant_conversations (id) on delete cascade,
  tool_key text not null,
  arguments jsonb not null default '{}',
  -- proposed = el modelo la pidió pero es de escritura, espera confirmación;
  -- confirmed = el usuario tocó "Confirmar", a punto de ejecutarse;
  -- executed/failed = ya corrió; rejected = el usuario tocó "Cancelar".
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'executed', 'failed', 'rejected')),
  requires_confirmation boolean not null default false,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create index assistant_tool_calls_conversation_idx on public.assistant_tool_calls (conversation_id);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_tool_calls enable row level security;

-- Asistente personal — cada miembro ve y escribe solo lo suyo, nadie más
-- (ni siquiera el Owner) lee la conversación de otro. Distinto del resto
-- de los módulos de esta sesión (Cobranza/Metas), que son datos de equipo.
create policy assistant_conversations_all on public.assistant_conversations
  for all using (
    member_id in (select wm.id from public.workspace_members wm where wm.workspace_id = assistant_conversations.workspace_id and wm.user_id = auth.uid())
  )
  with check (
    member_id in (select wm.id from public.workspace_members wm where wm.workspace_id = assistant_conversations.workspace_id and wm.user_id = auth.uid())
  );

create policy assistant_messages_all on public.assistant_messages
  for all using (
    exists (
      select 1 from public.assistant_conversations c
      join public.workspace_members wm on wm.id = c.member_id
      where c.id = assistant_messages.conversation_id and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assistant_conversations c
      join public.workspace_members wm on wm.id = c.member_id
      where c.id = assistant_messages.conversation_id and wm.user_id = auth.uid()
    )
  );

create policy assistant_tool_calls_all on public.assistant_tool_calls
  for all using (
    member_id in (select wm.id from public.workspace_members wm where wm.workspace_id = assistant_tool_calls.workspace_id and wm.user_id = auth.uid())
  )
  with check (
    member_id in (select wm.id from public.workspace_members wm where wm.workspace_id = assistant_tool_calls.workspace_id and wm.user_id = auth.uid())
  );

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals', 'ai_assistant'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'ai_assistant', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'ai_assistant'
)
on conflict (workspace_id, module_key) do update set enabled = true;
