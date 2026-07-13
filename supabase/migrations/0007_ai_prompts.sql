-- Spec: docs/blueprint/02-database.md:139-152, docs/blueprint/05-ai-engine.md
-- "Prompt Builder". Management-only for now (create/version/activate/archive
-- prompts, assign tools to a prompt) — the engine that would actually run
-- these (Decision Engine/Agent Runtime/Tool Router, docs/blueprint/13-agent-engine.md)
-- doesn't exist yet (no Buffer Inteligente/YCloud/OpenRouter). Same
-- "read/manage, not yet live" posture already used for Inbox/Automatizaciones.
-- `tool_calls` (technical invocation log) is deliberately NOT migrated here —
-- nothing writes to it without a Tool Router.

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module_key text not null,
  name text not null,
  system_prompt text not null default '',
  variables jsonb not null default '{}',
  model_config jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  version int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists ai_prompts_workspace_module_idx
  on public.ai_prompts (workspace_id, module_key);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  json_schema jsonb not null default '{}',
  handler_key text not null,
  enabled boolean not null default true,
  unique (key)
);

create table if not exists public.agent_tools (
  prompt_id uuid not null references public.ai_prompts (id) on delete cascade,
  tool_id uuid not null references public.tools (id) on delete cascade,
  primary key (prompt_id, tool_id)
);

alter table public.ai_prompts enable row level security;
alter table public.tools enable row level security;
alter table public.agent_tools enable row level security;

-- ai_prompts: any member reads; only owner/admin write (docs/blueprint/09-security.md
-- RBAC table — "Editar prompts/tools" is owner/admin only, stricter than the
-- usual owner/admin/agent pattern used elsewhere in this schema).
create policy "ai_prompts_select" on public.ai_prompts
  for select using (core.is_workspace_member(workspace_id));
create policy "ai_prompts_insert" on public.ai_prompts
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy "ai_prompts_update" on public.ai_prompts
  for update
  using (core.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- tools: select-only from the app (global catalog seeded below + any
-- workspace-owned rows, though nothing creates those in this pass) — no
-- write policy needed since nothing inserts/updates tools via the client yet.
create policy "tools_select" on public.tools
  for select using (workspace_id is null or core.is_workspace_member(workspace_id));

-- agent_tools: scoped via its parent ai_prompts row (same pattern as
-- contact_tags/pipeline_items — no workspace_id column of its own).
create policy "agent_tools_select" on public.agent_tools
  for select using (
    exists (
      select 1 from public.ai_prompts p
      where p.id = agent_tools.prompt_id and core.is_workspace_member(p.workspace_id)
    )
  );
create policy "agent_tools_write" on public.agent_tools
  for all
  using (
    exists (
      select 1 from public.ai_prompts p
      where p.id = agent_tools.prompt_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin'])
    )
  )
  with check (
    exists (
      select 1 from public.ai_prompts p
      where p.id = agent_tools.prompt_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin'])
    )
  );

-- Global tool catalog (workspace_id = null) — the example tools already
-- named explicitly in docs/blueprint/05-ai-engine.md. Rows are metadata/catalog
-- entries only; handler_key doesn't resolve to a real file yet (no Tool
-- Router to invoke it), same as automations having no execution engine yet.
insert into public.tools (key, name, description, handler_key) values
  ('search_contact', 'Buscar contacto', 'Busca un contacto del workspace por nombre, teléfono o empresa.', 'search_contact'),
  ('query_crm_context', 'Consultar contexto CRM', 'Consulta la oportunidad y etapa de pipeline asociadas al contacto.', 'query_crm_context'),
  ('create_opportunity', 'Crear oportunidad', 'Crea una oportunidad de venta para el contacto actual.', 'create_opportunity'),
  ('check_agenda_availability', 'Consultar disponibilidad', 'Consulta horarios disponibles en la agenda.', 'check_agenda_availability'),
  ('create_appointment', 'Agendar reunión', 'Crea una reunión en la agenda para el contacto actual.', 'create_appointment'),
  ('run_automation', 'Ejecutar automatización', 'Dispara una automatización configurada del workspace.', 'run_automation'),
  ('score_candidate', 'Puntuar candidato', 'Puntúa a un candidato contra los requisitos de una vacante (ATS).', 'score_candidate'),
  ('extract_resume_data', 'Extraer datos de CV', 'Extrae experiencia, educación y habilidades de un CV adjunto (ATS).', 'extract_resume_data')
on conflict (key) do nothing;
